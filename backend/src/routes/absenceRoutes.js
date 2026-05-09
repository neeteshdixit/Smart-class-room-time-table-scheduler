const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRoles } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { body } = require("express-validator");

const router = express.Router();

/**
 * 1. Mark Faculty as Absent (Enter Leave)
 */
router.post(
  "/leave",
  authRequired,
  requireRoles("admin"),
  [
    body("faculty_id").isInt({ min: 1 }),
    body("start_date").isDate(),
    body("end_date").isDate(),
    body("reason").optional().trim(),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const { faculty_id, start_date, end_date, reason } = req.body;
      
      const result = await pool.query(
        `INSERT INTO faculty_leaves (faculty_id, start_date, end_date, reason, status)
         VALUES ($1, $2, $3, $4, 'Approved')
         RETURNING *`,
        [faculty_id, start_date, end_date, reason || "Absent"]
      );

      res.json({ message: "Faculty marked absent", leave: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 2. Find Affected Classes for a Leave
 */
router.get(
  "/affected-classes",
  authRequired,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const { faculty_id, date } = req.query;
      if (!faculty_id || !date) {
        return res.status(400).json({ message: "faculty_id and date are required" });
      }

      const dayOfWeek = new Date(date).getDay() || 7;

      const result = await pool.query(`
        SELECT te.*, ts.start_time, ts.end_time, ts.slot_number, s.subject_name, sec.section_name, c.room_number
        FROM timetable_entries te
        JOIN time_slots ts ON te.timeslot_id = ts.id
        JOIN subjects s ON te.subject_id = s.id
        JOIN sections sec ON te.section_id = sec.id
        JOIN classrooms c ON te.classroom_id = c.id
        JOIN timetables t ON te.timetable_id = t.id
        WHERE te.faculty_id = $1
          AND ts.day_of_week = $2
          AND t.status IN ('Approved', 'Draft')
      `, [faculty_id, dayOfWeek]);

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 3. Suggest Substitutes for a Specific Entry
 */
router.get(
  "/suggest-substitutes",
  authRequired,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const { entry_id, date } = req.query;
      if (!entry_id || !date) {
        return res.status(400).json({ message: "entry_id and date are required" });
      }

      // 1. Get entry details
      const entryResult = await pool.query(`
        SELECT te.*, ts.day_of_week, ts.slot_number, ts.id as timeslot_id
        FROM timetable_entries te
        JOIN time_slots ts ON te.timeslot_id = ts.id
        WHERE te.id = $1
      `, [entry_id]);
      
      if (entryResult.rowCount === 0) {
        return res.status(404).json({ message: "Entry not found" });
      }
      const entry = entryResult.rows[0];

      // 2. Find faculty who are FREE at this timeslot on this day
      // A faculty is free if they don't have an entry in ANY approved/draft timetable for this timeslot
      // AND they are not on leave
      const substitutes = await pool.query(`
        SELECT f.id, f.full_name, f.email, f.designation
        FROM faculty f
        WHERE f.id NOT IN (
          SELECT faculty_id 
          FROM timetable_entries te
          JOIN timetables t ON te.timetable_id = t.id
          WHERE te.timeslot_id = $1 
            AND t.status IN ('Approved', 'Draft')
        )
        AND f.id NOT IN (
          SELECT faculty_id 
          FROM faculty_leaves 
          WHERE $2::date BETWEEN start_date AND end_date
            AND status = 'Approved'
        )
        LIMIT 10
      `, [entry.timeslot_id, date]);

      res.json(substitutes.rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 4. Assign Substitution
 */
router.post(
  "/assign-substitution",
  authRequired,
  requireRoles("admin"),
  [
    body("original_entry_id").isInt({ min: 1 }),
    body("substitute_faculty_id").isInt({ min: 1 }),
    body("substitution_date").isDate(),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const { original_entry_id, substitute_faculty_id, substitution_date, reason } = req.body;
      
      const result = await pool.query(
        `INSERT INTO timetable_substitutions (original_entry_id, substitute_faculty_id, substitution_date, reason, status)
         VALUES ($1, $2, $3, $4, 'Assigned')
         RETURNING *`,
        [original_entry_id, substitute_faculty_id, substitution_date, reason || "Faculty Absence"]
      );

      res.json({ message: "Substitution assigned", substitution: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
