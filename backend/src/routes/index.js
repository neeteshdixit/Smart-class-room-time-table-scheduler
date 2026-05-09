const express = require("express");
const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");
const statsRoutes = require("./statsRoutes");
const masterDataRoutes = require("./masterDataRoutes");
const timetableRoutes = require("./timetableRoutes");
const dashboardDataRoutes = require("./dashboardDataRoutes");
const facultyRoutes = require("./facultyRoutes");
const mentorRoutes = require("./mentorRoutes");
const chatRoutes = require("./chatRoutes");
const aiRoutes = require("./aiRoutes");
const studentRoutes = require("./studentRoutes");
const absenceRoutes = require("./absenceRoutes");
const feedbackRoutes = require("./feedbackRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/stats", statsRoutes);
router.use("/master", masterDataRoutes);
router.use("/timetable", timetableRoutes);
router.use("/faculty", facultyRoutes);
router.use("/mentor", mentorRoutes);
router.use("/chat", chatRoutes);
router.use("/ai", aiRoutes);
router.use("/student", studentRoutes);
router.use("/absence", absenceRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/", dashboardDataRoutes);

if (Array.isArray(timetableRoutes.generateTimetableMiddleware)) {
  router.post("/generate-timetable", ...timetableRoutes.generateTimetableMiddleware);
}

if (Array.isArray(timetableRoutes.getTimetableHistoryMiddleware)) {
  router.get("/timetable-history", ...timetableRoutes.getTimetableHistoryMiddleware);
}

router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
