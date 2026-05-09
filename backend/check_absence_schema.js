require('dotenv').config({ path: '../.env' });
const pool = require("./src/config/db");
async function check() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'faculty_leaves'");
    console.log("faculty_leaves:", res.rows);
    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'timetable_substitutions'");
    console.log("timetable_substitutions:", res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
