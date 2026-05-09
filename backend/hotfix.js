require('dotenv').config({ path: '../.env' });
const pool = require('./src/config/db');

async function hotfix() {
    console.log('Running hotfix...');
    try {
        // Drop the foreign key constraint if it exists
        // We need to find the constraint name first, or just try to drop it by pattern
        // Usually it's 'chat_history_user_id_fkey'
        await pool.query(`
            ALTER TABLE chat_history 
            DROP CONSTRAINT IF EXISTS chat_history_user_id_fkey;
        `);
        console.log('Constraint dropped successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Hotfix failed:', err);
        process.exit(1);
    }
}

hotfix();
