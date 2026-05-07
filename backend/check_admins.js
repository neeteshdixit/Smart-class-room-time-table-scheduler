require('dotenv').config({path: '../.env'});
const pool = require('./src/config/db');
pool.query("SELECT id, role, email FROM faculty_users WHERE LOWER(role) = 'admin'").then(res => console.log(res.rows)).finally(() => process.exit(0));
