const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validateRequest } = require('../utils/validation');
const aiService = require('../services/aiService');
const { generateChatReply } = require('../services/chatService');
const substitutionService = require('../services/substitutionService');
const pool = require('../config/db');

/**
 * AI Powered Endpoints for NexusAI
 */

// 1. Extract Intent from Email/Text (for Leaves)
router.post('/extract-intent', authRequired, async (req, res, next) => {
    try {
        const { text } = req.body;
        const details = await aiService.extractLeaveIntent(text);
        res.json(details);
    } catch (err) {
        next(err);
    }
});

router.get('/health', authRequired, async (req, res, next) => {
    try {
        const health = await aiService.healthCheck();
        res.json(health);
    } catch (err) {
        next(err);
    }
});

router.post(
    '/chat',
    authRequired,
    [body('message').trim().isLength({ min: 1, max: 2000 }), validateRequest],
    async (req, res, next) => {
        try {
            const response = await generateChatReply({
                message: req.body.message,
                user: req.user,
                pageContext: req.body.page_context || req.body.current_path || '',
            });
            res.json(response);
        } catch (err) {
            next(err);
        }
    }
);

// 2. Submit Leave Request (AI Assisted)
router.post('/leave', authRequired, async (req, res, next) => {
    try {
        const { startDate, endDate, reason, urgency, aiMetadata } = req.body;
        // Resolve faculty.id from req.user.userId (which is faculty_users.id)
        const result = await pool.query(`
            INSERT INTO faculty_leaves (faculty_id, start_date, end_date, reason, urgency, ai_extracted_metadata)
            VALUES (
                (SELECT id FROM faculty WHERE faculty_id = (SELECT faculty_id FROM faculty_users WHERE id = $1)),
                $2, $3, $4, $5, $6
            )
            RETURNING *
        `, [req.user.userId, startDate, endDate, reason, urgency, aiMetadata]);
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// 3. Find Substitutes for a clash/absence
router.get('/find-substitutes', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const { timetableId, facultyId, timeslotId } = req.query;
        const candidates = await substitutionService.findSubstitutes(timetableId, facultyId, timeslotId);
        res.json(candidates);
    } catch (err) {
        next(err);
    }
});

// 4. Confirm Substitution
router.post('/substitute', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const { entryId, substituteId, date, reason } = req.body;
        const result = await substitutionService.proposeSubstitution(entryId, substituteId, date, reason);
        
        // Notify the substitute faculty
        // Resolve faculty_users.id from faculty.id (substituteId)
        await pool.query(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                (SELECT id FROM faculty_users WHERE faculty_id = (SELECT faculty_id FROM faculty WHERE id = $1)),
                'New Substitution Assigned', $2, 'SUBSTITUTION'
            )
        `, [substituteId, `You have a substitution class on ${date}. Reason: ${reason}`]);

        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
