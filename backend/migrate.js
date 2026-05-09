require('dotenv').config({ path: '../.env' });
const pool = require('./src/config/db');
const { initializeSchema } = require('./src/db/initializeSchema');

async function migrate() {
    console.log('Starting migration...');
    try {
        await initializeSchema(pool);
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
