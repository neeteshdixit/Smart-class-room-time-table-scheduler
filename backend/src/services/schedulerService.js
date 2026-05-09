const cron = require("node-cron");
const pool = require("../config/db");
const mailer = require("../utils/mailer");

/**
 * Daily Timetable Update (Run at 7 PM every day)
 * Informs students and faculty about tomorrow's schedule.
 */
async function sendDailyUpdates() {
  console.log("[Scheduler] Running Daily Timetable Update...");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayOfWeek = tomorrow.getDay() || 7; // 1-7 (Mon-Sun)

  try {
    // 1. Fetch all classes for tomorrow
    const entriesResult = await pool.query(`
      SELECT te.*, ts.start_time, ts.end_time, s.subject_name, s.subject_code,
             f.email as faculty_email, f.full_name as faculty_name,
             sec.section_name, sec.id as section_id,
             c.room_number
      FROM timetable_entries te
      JOIN time_slots ts ON te.timeslot_id = ts.id
      JOIN subjects s ON te.subject_id = s.id
      JOIN faculty_users f ON te.faculty_id = f.id
      JOIN sections sec ON te.section_id = sec.id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN timetables t ON te.timetable_id = t.id
      WHERE ts.day_of_week = $1 AND t.status = 'Approved'
    `, [dayOfWeek]);

    const entries = entriesResult.rows;
    if (entries.length === 0) {
      console.log("[Scheduler] No classes tomorrow.");
      return;
    }

    // 2. Group by Faculty
    const facultyGroups = new Map();
    entries.forEach(e => {
      if (!facultyGroups.has(e.faculty_email)) {
        facultyGroups.set(e.faculty_email, { name: e.faculty_name, classes: [] });
      }
      facultyGroups.get(e.faculty_email).classes.push(e);
    });

    // 3. Group by Section
    const sectionGroups = new Map();
    entries.forEach(e => {
      if (!sectionGroups.has(e.section_id)) {
        sectionGroups.set(e.section_id, { name: e.section_name, classes: [] });
      }
      sectionGroups.get(e.section_id).classes.push(e);
    });

    // 4. Send emails to Faculty
    for (const [email, data] of facultyGroups) {
      const classList = data.classes
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map(c => `- ${c.start_time} - ${c.end_time}: ${c.subject_name} (${c.section_name}) at ${c.room_number}`)
        .join("\n");

      await mailer.sendEmail({
        to: email,
        subject: "Your Classes Tomorrow",
        text: `Hello ${data.name},\n\nHere is your teaching schedule for tomorrow:\n\n${classList}\n\nHave a great day!`,
      }).catch(err => console.error(`[Scheduler] Failed faculty email to ${email}:`, err.message));
    }

    // 5. Send emails to Students (per section)
    for (const [sectionId, data] of sectionGroups) {
      const studentsResult = await pool.query("SELECT email FROM students WHERE section_id = $1", [sectionId]);
      const studentEmails = studentsResult.rows.map(s => s.email);

      if (studentEmails.length === 0) continue;

      const classList = data.classes
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map(c => `- ${c.start_time} - ${c.end_time}: ${c.subject_name} by ${c.faculty_name} at ${c.room_number}`)
        .join("\n");

      await mailer.sendBulkEmail(studentEmails, () => ({
        subject: `Tomorrow's Timetable: ${data.name}`,
        text: `Hello Students,\n\nHere is your class schedule for tomorrow (${data.name}):\n\n${classList}\n\nBe on time!`,
      })).catch(err => console.error(`[Scheduler] Failed bulk student email for section ${data.name}:`, err.message));
    }

    console.log("[Scheduler] Daily updates sent successfully.");
  } catch (err) {
    console.error("[Scheduler] Error in sendDailyUpdates:", err);
  }
}

/**
 * Class Reminders (Run every minute)
 * Checks for classes starting in 10 minutes.
 */
async function sendClassReminders() {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  
  // Calculate target time (10 minutes from now)
  const targetTime = new Date(now.getTime() + 10 * 60 * 1000);
  const targetTimeString = targetTime.toTimeString().split(' ')[0]; // HH:MM:SS
  const targetMinute = targetTimeString.slice(0, 5); // HH:MM

  try {
    // Fetch classes starting in exactly 10 minutes (matching by HH:MM)
    const result = await pool.query(`
      SELECT te.*, ts.start_time, s.subject_name,
             f.email as faculty_email, f.full_name as faculty_name,
             sec.section_name, sec.id as section_id,
             c.room_number
      FROM timetable_entries te
      JOIN time_slots ts ON te.timeslot_id = ts.id
      JOIN subjects s ON te.subject_id = s.id
      JOIN faculty_users f ON te.faculty_id = f.id
      JOIN sections sec ON te.section_id = sec.id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN timetables t ON te.timetable_id = t.id
      WHERE ts.day_of_week = $1 
        AND LEFT(ts.start_time::text, 5) = $2
        AND t.status = 'Approved'
    `, [dayOfWeek, targetMinute]);

    for (const entry of result.rows) {
      // 1. Remind Faculty
      await mailer.sendEmail({
        to: entry.faculty_email,
        subject: "Class Reminder",
        text: `Hello ${entry.faculty_name},\n\nYour class "${entry.subject_name}" for ${entry.section_name} is starting in 10 minutes at ${entry.room_number}.\n\nGood luck!`,
      }).catch(err => console.error(`[Scheduler] Reminder failed for faculty ${entry.faculty_email}:`, err.message));

      // 2. Remind Students
      const studentsResult = await pool.query("SELECT email FROM students WHERE section_id = $1", [entry.section_id]);
      const studentEmails = studentsResult.rows.map(s => s.email);

      if (studentEmails.length > 0) {
        await mailer.sendBulkEmail(studentEmails, () => ({
          subject: `Class Starting Soon: ${entry.subject_name}`,
          text: `Hello Students,\n\nYour class "${entry.subject_name}" in ${entry.section_name} is starting in 10 minutes in room ${entry.room_number}.`,
        })).catch(err => console.error(`[Scheduler] Reminder failed for students of section ${entry.section_name}:`, err.message));
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error in sendClassReminders:", err);
  }
}

function initScheduler() {
  // 1. Daily Update at 7 PM (19:00)
  cron.schedule("0 19 * * *", () => {
    sendDailyUpdates();
  });

  // 2. Class Reminders every minute
  cron.schedule("* * * * *", () => {
    sendClassReminders();
  });

  console.log("[Scheduler] Automated timetable reminders initialized.");
}

module.exports = { initScheduler };
