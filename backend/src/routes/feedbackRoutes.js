const express = require("express");
const { body } = require("express-validator");
const { authRequired, requireRoles } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const feedbackService = require("../services/feedbackService");

const router = express.Router();

function getFiltersFromQuery(query = {}) {
  return {
    range: query.range,
    timeframe: query.timeframe,
    start_date: query.start_date,
    end_date: query.end_date,
    role: query.role,
    sentiment: query.sentiment,
    emotion: query.emotion,
    category: query.category,
    urgency: query.urgency,
    department: query.department,
    q: query.q,
    search: query.search,
    page: query.page,
    limit: query.limit,
  };
}

router.post(
  "/",
  authRequired,
  [
    body("feedback_text")
      .trim()
      .isLength({ min: 5, max: 2000 })
      .withMessage("Feedback text must be between 5 and 2000 characters"),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const result = await feedbackService.saveFeedback({
        user: req.user,
        feedbackText: req.body.feedback_text,
        pageContext: req.body.page_context || req.body.current_path || "",
      });

      return res.status(201).json({
        message: "Feedback analyzed and stored successfully",
        ...result,
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get("/analytics", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const snapshot = await feedbackService.getFeedbackAnalyticsSnapshot(getFiltersFromQuery(req.query), {
      includeAiInsights: true,
      recentLimit: Number(req.query.recent_limit) || 5,
    });
    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
});

router.get("/trends", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const snapshot = await feedbackService.getFeedbackTrendSnapshot(getFiltersFromQuery(req.query));
    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
});

router.get("/issues", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const snapshot = await feedbackService.listFeedbackIssues(getFiltersFromQuery(req.query));
    return res.json(snapshot);
  } catch (err) {
    return next(err);
  }
});

router.get("/unread-count", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const result = await feedbackService.getUnreadFeedbackCount();
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id/read", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const result = await feedbackService.markFeedbackAsRead(req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
