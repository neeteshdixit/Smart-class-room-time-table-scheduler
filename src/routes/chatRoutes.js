const express = require("express");
const { body } = require("express-validator");
const { authRequired } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { generateChatReply } = require("../services/chatService");

const router = express.Router();

router.post(
  "/",
  authRequired,
  [body("message").trim().isLength({ min: 1, max: 2000 }), validateRequest],
  async (req, res, next) => {
    try {
      const response = await generateChatReply({
        message: req.body.message,
        user: req.user,
      });
      return res.json(response);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
