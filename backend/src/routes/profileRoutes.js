const express = require("express");
const { body } = require("express-validator");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { authRequired } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { logActivity } = require("../utils/activity");
const { uploadProfilePhoto } = require("../middleware/upload");
const { findAuthById, deleteUserById } = require("../models/facultyUserModel");

const router = express.Router();

function buildRouteError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

router.get("/", authRequired, async (req, res, next) => {
  try {
    const role = String(req.user.role || "").toLowerCase();
    
    if (role === 'student') {
      const result = await pool.query(
        `SELECT s.id, s.student_id, s.full_name, s.email, s.section_id, sec.section_name as section, 
                b.branch_name as branch, sem.semester_number as semester, s.created_at
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.id
         LEFT JOIN branches b ON sec.branch_id = b.id
         LEFT JOIN semesters sem ON sec.semester_id = sem.id
         WHERE s.id = $1`,
        [req.user.userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Student profile not found" });
      }

      return res.json({ profile: { ...result.rows[0], role: 'student' } });
    }

    const result = await pool.query(
      `SELECT id, faculty_id, full_name, department, designation, email, mobile_number, gender, dob,
              qualification, experience_years, address, joining_date, profile_photo_url, role,
              is_mentor, employee_type, office_location, created_at, last_login
       FROM faculty_users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json({ profile: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.put(
  "/",
  authRequired,
  [
    body("full_name").optional().trim().notEmpty(),
    body("department").optional().trim().notEmpty(),
    body("designation").optional().trim().notEmpty(),
    body("email").optional().isEmail(),
    body("mobile_number").optional().matches(/^[0-9]{10,15}$/),
    body("gender").optional().trim().notEmpty(),
    body("dob").optional().isISO8601(),
    body("qualification").optional().trim().notEmpty(),
    body("experience_years").optional().isFloat({ min: 0 }),
    body("address").optional().trim().notEmpty(),
    body("joining_date").optional().isISO8601(),
    body("profile_photo_url").optional().trim(),
    body("employee_type").optional().trim().notEmpty(),
    body("office_location").optional().trim(),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const role = String(req.user.role || "").toLowerCase();
      
      if (role === 'student') {
        const allowedStudentFields = ["full_name", "email", "section_id"];
        const updates = [];
        const values = [];

        allowedStudentFields.forEach((field) => {
          if (req.body[field] !== undefined) {
            values.push(field === "email" ? String(req.body[field]).toLowerCase() : req.body[field]);
            updates.push(`${field} = $${values.length}`);
          }
        });

        if (updates.length === 0) {
          return res.status(400).json({ message: "No valid fields provided for update" });
        }

        const newEmail = req.body.email ? String(req.body.email).toLowerCase() : null;
        if (newEmail) {
          const conflictCheck = await pool.query(
            "SELECT id FROM students WHERE id <> $1 AND email = $2 LIMIT 1",
            [req.user.userId, newEmail]
          );
          if (conflictCheck.rowCount > 0) {
            return res.status(409).json({ message: "Email is already in use" });
          }
        }

        values.push(req.user.userId);
        const result = await pool.query(
          `UPDATE students
           SET ${updates.join(", ")}
           WHERE id = $${values.length}
           RETURNING id, student_id, full_name, email, section_id`,
          values
        );
        
        await logActivity(req.user.userId, "Profile Updated", "Student profile details updated");
        return res.json({ message: "Profile updated successfully", profile: { ...result.rows[0], role: 'student' } });
      }

      const allowedFields = [
        "full_name",
        "department",
        "designation",
        "email",
        "mobile_number",
        "gender",
        "dob",
        "qualification",
        "experience_years",
        "address",
        "joining_date",
        "profile_photo_url",
        "employee_type",
        "office_location",
      ];

      const updates = [];
      const values = [];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          values.push(field === "email" ? String(req.body[field]).toLowerCase() : req.body[field]);
          updates.push(`${field} = $${values.length}`);
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ message: "No valid fields provided for update" });
      }

      const newEmail = req.body.email ? String(req.body.email).toLowerCase() : null;
      const newMobile = req.body.mobile_number || null;

      if (newEmail || newMobile) {
        const conflictCheck = await pool.query(
          `SELECT id FROM faculty_users
           WHERE id <> $1 AND (email = $2 OR mobile_number = $3)
           LIMIT 1`,
          [req.user.userId, newEmail, newMobile]
        );

        if (conflictCheck.rowCount > 0) {
          return res.status(409).json({ message: "Email or mobile number is already in use" });
        }
      }

      values.push(req.user.userId);
      const updateQuery = `
        UPDATE faculty_users
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, faculty_id, full_name, department, designation, email, mobile_number, gender, dob,
                  qualification, experience_years, address, joining_date, profile_photo_url, role,
                  is_mentor, employee_type, office_location, created_at, last_login
      `;

      const result = await pool.query(updateQuery, values);
      await logActivity(req.user.userId, "Profile Updated", "Faculty profile details updated");

      return res.json({ message: "Profile updated successfully", profile: result.rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

router.post("/photo", authRequired, uploadProfilePhoto, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const photoUrl = `/uploads/profile-photos/${req.file.filename}`;

    await pool.query(
      `UPDATE faculty_users
       SET profile_photo_url = $1
       WHERE id = $2`,
      [photoUrl, req.user.userId]
    );

    await logActivity(req.user.userId, "Profile Photo Updated", "User updated their profile picture");

    return res.json({
      message: "Profile photo updated successfully",
      profile_photo_url: photoUrl,
    });
  } catch (err) {
    return next(err);
  }
});

// Deleted old /delete-account route in favor of secure OTP flow in authRoutes.js

module.exports = router;
