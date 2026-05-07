require('dotenv').config({ path: '../.env' });
const pool = require('./src/config/db');
async function check() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'faculty_users'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
check();
