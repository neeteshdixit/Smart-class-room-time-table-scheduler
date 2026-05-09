const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

// 1. Student Login
router.post('/login', async (req, res, next) => {
    try {
        const { studentId, password } = req.body;
        const result = await pool.query('SELECT * FROM students WHERE student_id = $1', [studentId]);
        
        if (result.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const student = result.rows[0];
        const isMatch = await bcrypt.compare(password, student.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: student.id, role: 'student', sectionId: student.section_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            token,
            student: {
                id: student.id,
                student_id: student.student_id,
                full_name: student.full_name,
                section_id: student.section_id
            }
        });
    } catch (err) {
        next(err);
    }
});

// 2. Get Student's Personal Timetable
router.get('/my-timetable', authRequired, async (req, res, next) => {
    try {
        const userRole = String(req.user.role || "").toLowerCase();
        if (userRole !== "user" && userRole !== "student" && userRole !== "admin") {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const sectionId = req.user.sectionId;
        if (!sectionId) {
            return res.status(400).json({ message: "Section not assigned" });
        }

        const { date } = req.query;
        const values = [sectionId];
        let dateFilter = "";
        if (date) {
            values.push(date);
            dateFilter = "AND tsub.substitution_date = $2";
        }

        const result = await pool.query(`
            SELECT te.*, 
            COALESCE(sub_f.full_name, f.full_name) as faculty_name, 
            s.subject_name, s.subject_code,
            c.room_number, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_number,
            CASE WHEN tsub.id IS NOT NULL THEN TRUE ELSE FALSE END as is_substituted
            FROM timetable_entries te
            JOIN faculty f ON te.faculty_id = f.id
            JOIN subjects s ON te.subject_id = s.id
            JOIN classrooms c ON te.classroom_id = c.id
            JOIN time_slots ts ON te.timeslot_id = ts.id
            JOIN timetables t ON te.timetable_id = t.id
            LEFT JOIN timetable_substitutions tsub ON te.id = tsub.original_entry_id ${date ? "AND tsub.substitution_date = $2" : "AND 1=0"}
            LEFT JOIN faculty sub_f ON tsub.substitute_faculty_id = sub_f.id
            WHERE te.section_id = $1 AND t.status IN ('Approved', 'Draft')
            ORDER BY ts.day_of_week, ts.slot_number
        `, values);

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// 3. Get Student Notifications
router.get('/notifications', authRequired, async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT * FROM notifications 
            WHERE student_id = $1 
            ORDER BY created_at DESC 
            LIMIT 20
        `, [req.user.userId]);
        
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
