const pool = require("../config/db");

function getDb(db) {
  return db || pool;
}

async function addSectionMentorMappings(facultyUserId, sectionIds, db) {
  const conn = getDb(db);
  if (!sectionIds.length) return;

  await conn.query(
    `INSERT INTO section_mentors (faculty_id, section_id)
     SELECT $1, UNNEST($2::int[])
     ON CONFLICT (faculty_id, section_id) DO NOTHING`,
    [facultyUserId, sectionIds]
  );
}

async function listMentorSectionsByFacultyUserId(facultyUserId, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT s.id, s.section_name, s.semester_id,
            sem.semester_number, sem.academic_year,
            b.branch_name,
            d.department_name
     FROM section_mentors sm
     JOIN sections s ON s.id = sm.section_id
     JOIN semesters sem ON sem.id = s.semester_id
     JOIN branches b ON b.id = sem.branch_id
     JOIN departments d ON d.id = b.department_id
     WHERE sm.faculty_id = $1
     ORDER BY d.department_name, b.branch_name, sem.semester_number, s.section_name`,
    [facultyUserId]
  );
  return result.rows;
}

async function isMentorMappedToSection(facultyUserId, sectionId, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT 1
     FROM section_mentors
     WHERE faculty_id = $1
       AND section_id = $2
     LIMIT 1`,
    [facultyUserId, sectionId]
  );
  return result.rowCount > 0;
}

module.exports = {
  addSectionMentorMappings,
  listMentorSectionsByFacultyUserId,
  isMentorMappedToSection,
};

