const express = require("express");
const { body } = require("express-validator");
const pool = require("../config/db");
const { authRequired } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { logActivity } = require("../utils/activity");

const router = express.Router();

router.get("/", authRequired, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, faculty_id, full_name, department, designation, email, mobile_number, gender, dob,
              qualification, experience_years, address, joining_date, profile_photo_url, role,
              employee_type, office_location, created_at, last_login
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
    body("role").optional().trim().notEmpty(),
    body("employee_type").optional().trim().notEmpty(),
    body("office_location").optional().trim(),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
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
        "role",
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
                  employee_type, office_location, created_at, last_login
      `;

      const result = await pool.query(updateQuery, values);
      await logActivity(req.user.userId, "Profile Updated", "Faculty profile details updated");

      return res.json({ message: "Profile updated successfully", profile: result.rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
