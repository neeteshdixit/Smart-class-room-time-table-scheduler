const pool = require('../config/db');

class NotificationService {
    /**
     * Sends a notification to a specific user (Faculty or Student)
     */
    async sendNotification({ userId, studentId, title, message, type }) {
        try {
            const result = await pool.query(`
                INSERT INTO notifications (user_id, student_id, title, message, type)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [userId || null, studentId || null, title, message, type]);
            
            // In a real-world app, we would trigger a WebPush or Socket.io event here
            return result.rows[0];
        } catch (err) {
            console.error('Failed to send notification:', err);
            throw err;
        }
    }

    /**
     * Broadcasts a notification to an entire section (all students)
     */
    async broadcastToSection(sectionId, title, message, type) {
        try {
            const students = await pool.query('SELECT id FROM students WHERE section_id = $1', [sectionId]);
            const promises = students.rows.map(student => 
                this.sendNotification({ studentId: student.id, title, message, type })
            );
            return await Promise.all(promises);
        } catch (err) {
            console.error('Failed to broadcast to section:', err);
            throw err;
        }
    }

    async getUnreadCount(userId, isStudent = false) {
        const field = isStudent ? 'student_id' : 'user_id';
        const res = await pool.query(`SELECT COUNT(*) FROM notifications WHERE ${field} = $1 AND is_read = FALSE`, [userId]);
        return parseInt(res.rows[0].count);
    }
}

module.exports = new NotificationService();
