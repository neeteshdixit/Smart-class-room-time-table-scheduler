ALTER TABLE faculty DROP CONSTRAINT IF EXISTS faculty_department_id_fkey;
ALTER TABLE faculty ADD CONSTRAINT faculty_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_department_id_fkey;
ALTER TABLE subjects ADD CONSTRAINT subjects_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_branch_id_fkey;
ALTER TABLE subjects ADD CONSTRAINT subjects_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE subject_faculty_assignment DROP CONSTRAINT IF EXISTS subject_faculty_assignment_faculty_id_fkey;
ALTER TABLE subject_faculty_assignment ADD CONSTRAINT subject_faculty_assignment_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE;

ALTER TABLE timetable_entries DROP CONSTRAINT IF EXISTS timetable_entries_faculty_id_fkey;
ALTER TABLE timetable_entries ADD CONSTRAINT timetable_entries_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE;

ALTER TABLE timetable_entries DROP CONSTRAINT IF EXISTS timetable_entries_classroom_id_fkey;
ALTER TABLE timetable_entries ADD CONSTRAINT timetable_entries_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE;

ALTER TABLE timetable_entries DROP CONSTRAINT IF EXISTS timetable_entries_timeslot_id_fkey;
ALTER TABLE timetable_entries ADD CONSTRAINT timetable_entries_timeslot_id_fkey FOREIGN KEY (timeslot_id) REFERENCES time_slots(id) ON DELETE CASCADE;
