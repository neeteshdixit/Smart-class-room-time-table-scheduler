const pool = require('../config/db');

class SubstitutionService {
    /**
     * Finds potential substitutes for a given slot.
     * Criteria:
     * 1. Faculty must be free at that timeslot.
     * 2. Faculty should ideally teach the same subject or be in the same department.
     * 3. Faculty workload should not exceed limits.
     */
    async findSubstitutes(timetableId, facultyId, timeslotId) {
        // Step 1: Get details of the original class
        const originalEntry = await pool.query(`
            SELECT te.*, s.department_id, s.subject_type
            FROM timetable_entries te
            JOIN subjects s ON te.subject_id = s.id
            WHERE te.timetable_id = $1 AND te.faculty_id = $2 AND te.timeslot_id = $3
        `, [timetableId, facultyId, timeslotId]);

        if (originalEntry.rowCount === 0) return [];

        const { department_id, subject_id } = originalEntry.rows[0];

        // Step 2: Find all faculty who are FREE at this timeslot
        const freeFaculty = await pool.query(`
            SELECT f.id, f.full_name, f.faculty_id, f.department_id,
            (SELECT COUNT(*) FROM timetable_entries WHERE faculty_id = f.id AND timetable_id = $1) as current_workload
            FROM faculty f
            WHERE f.id NOT IN (
                SELECT faculty_id FROM timetable_entries 
                WHERE timetable_id = $1 AND timeslot_id = $2
            )
            AND f.id != $3
        `, [timetableId, timeslotId, facultyId]);

        // Step 3: Rank them
        const candidates = freeFaculty.rows.map(f => {
            let score = 0;
            // High priority if they teach the same subject
            // (Need to check faculty_subjects table)
            
            // Priority for same department
            if (f.department_id === department_id) score += 50;
            
            // Priority for lower workload
            score += (30 - f.current_workload) * 2;

            return { ...f, matchScore: score };
        });

        return candidates.sort((a, b) => b.matchScore - a.matchScore);
    }

    async proposeSubstitution(entryId, substituteId, date, reason) {
        const res = await pool.query(`
            INSERT INTO timetable_substitutions (original_entry_id, substitute_faculty_id, substitution_date, reason)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [entryId, substituteId, date, reason]);
        
        return res.rows[0];
    }
}

module.exports = new SubstitutionService();
