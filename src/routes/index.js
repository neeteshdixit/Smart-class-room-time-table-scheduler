const express = require("express");
const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");
const statsRoutes = require("./statsRoutes");
const masterDataRoutes = require("./masterDataRoutes");
const timetableRoutes = require("./timetableRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/stats", statsRoutes);
router.use("/master", masterDataRoutes);
router.use("/timetable", timetableRoutes);

router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;

