CREATE TABLE IF NOT EXISTS faculty_users (
    id SERIAL PRIMARY KEY,
    faculty_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    department VARCHAR(120) NOT NULL,
    designation VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    mobile_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    gender VARCHAR(20) NOT NULL,
    dob DATE NOT NULL,
    qualification VARCHAR(120) NOT NULL,
    experience_years NUMERIC(4, 1) NOT NULL CHECK (experience_years >= 0),
    address TEXT NOT NULL,
    joining_date DATE NOT NULL,
    profile_photo_url TEXT,
    role VARCHAR(60) NOT NULL DEFAULT 'Faculty',
    employee_type VARCHAR(40) DEFAULT 'Permanent',
    office_location VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

DO $$
BEGIN
    UPDATE faculty_users
    SET role = 'Faculty'
    WHERE LOWER(role) NOT IN ('faculty', 'admin', 'user');

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_faculty_users_role'
    ) THEN
        ALTER TABLE faculty_users
        DROP CONSTRAINT chk_faculty_users_role;
    END IF;

    ALTER TABLE faculty_users
    ADD CONSTRAINT chk_faculty_users_role
    CHECK (LOWER(role) IN ('faculty', 'admin', 'user'));
END $$;

CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    faculty_user_id INTEGER NOT NULL REFERENCES faculty_users(id) ON DELETE CASCADE,
    mobile_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expiry_time TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES faculty_users(id) ON DELETE CASCADE,
    email VARCHAR(120) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expiry_time TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    faculty_user_id INTEGER NOT NULL REFERENCES faculty_users(id) ON DELETE CASCADE,
    email VARCHAR(120) NOT NULL,
    reset_token_hash TEXT NOT NULL,
    expiry_time TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    department_name VARCHAR(120) NOT NULL,
    department_code VARCHAR(25) UNIQUE NOT NULL,
    hod_name VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faculty_departments (
    id SERIAL PRIMARY KEY,
    faculty_user_id INTEGER NOT NULL REFERENCES faculty_users(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (faculty_user_id, department_id)
);

CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    branch_name VARCHAR(120) NOT NULL,
    branch_code VARCHAR(25) NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    program_type VARCHAR(10) NOT NULL CHECK (program_type IN ('UG', 'PG')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semesters (
    id SERIAL PRIMARY KEY,
    semester_number INTEGER NOT NULL CHECK (semester_number >= 1 AND semester_number <= 10),
    academic_year VARCHAR(15) NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    section_name VARCHAR(20) NOT NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    student_strength INTEGER NOT NULL DEFAULT 60 CHECK (student_strength > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (section_name, semester_id)
);

CREATE TABLE IF NOT EXISTS faculty (
    id SERIAL PRIMARY KEY,
    faculty_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    designation VARCHAR(120) NOT NULL,
    qualification VARCHAR(120) NOT NULL,
    experience_years NUMERIC(4, 1) NOT NULL CHECK (experience_years >= 0),
    max_workload_per_week INTEGER NOT NULL DEFAULT 30 CHECK (max_workload_per_week > 0),
    preferred_time_slots JSONB,
    avg_leaves_per_month NUMERIC(4, 2) DEFAULT 0 CHECK (avg_leaves_per_month >= 0),
    email VARCHAR(120) UNIQUE NOT NULL,
    mobile_number VARCHAR(20) UNIQUE NOT NULL,
    joining_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(140) NOT NULL,
    subject_code VARCHAR(40) NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    subject_type VARCHAR(30) NOT NULL CHECK (subject_type IN ('Theory', 'Practical', 'Theory + Practical', 'Both')),
    total_hours INTEGER NOT NULL DEFAULT 0 CHECK (total_hours >= 0),
    theory_hours INTEGER NOT NULL DEFAULT 0 CHECK (theory_hours >= 0),
    practical_hours INTEGER NOT NULL DEFAULT 0 CHECK (practical_hours >= 0),
    requires_lab BOOLEAN NOT NULL DEFAULT FALSE,
    theory_hours_per_week INTEGER NOT NULL DEFAULT 0 CHECK (theory_hours_per_week >= 0),
    practical_hours_per_week INTEGER NOT NULL DEFAULT 0 CHECK (practical_hours_per_week >= 0),
    total_hours_semester INTEGER NOT NULL DEFAULT 0 CHECK (total_hours_semester >= 0),
    syllabus_file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branches_branch_code_key'
    ) THEN
        ALTER TABLE branches
        DROP CONSTRAINT branches_branch_code_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sections'
          AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE sections
        ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
    END IF;

    ALTER TABLE sections
    ALTER COLUMN student_strength SET DEFAULT 60;
END $$;

UPDATE sections s
SET branch_id = sem.branch_id
FROM semesters sem
WHERE s.semester_id = sem.id
  AND s.branch_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sections
        WHERE branch_id IS NULL
    ) THEN
        ALTER TABLE sections
        ALTER COLUMN branch_id SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'subjects'
          AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE subjects
        ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
    END IF;
END $$;

UPDATE subjects s
SET branch_id = sem.branch_id
FROM semesters sem
WHERE s.semester_id = sem.id
  AND s.branch_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM subjects
        WHERE branch_id IS NULL
    ) THEN
        ALTER TABLE subjects
        ALTER COLUMN branch_id SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'subjects_subject_code_key'
    ) THEN
        ALTER TABLE subjects
        DROP CONSTRAINT subjects_subject_code_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'subjects'
          AND column_name = 'total_hours'
    ) THEN
        ALTER TABLE subjects
        ADD COLUMN total_hours INTEGER NOT NULL DEFAULT 0 CHECK (total_hours >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'subjects'
          AND column_name = 'theory_hours'
    ) THEN
        ALTER TABLE subjects
        ADD COLUMN theory_hours INTEGER NOT NULL DEFAULT 0 CHECK (theory_hours >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'subjects'
          AND column_name = 'practical_hours'
    ) THEN
        ALTER TABLE subjects
        ADD COLUMN practical_hours INTEGER NOT NULL DEFAULT 0 CHECK (practical_hours >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'subjects'
          AND column_name = 'requires_lab'
    ) THEN
        ALTER TABLE subjects
        ADD COLUMN requires_lab BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

UPDATE subjects
SET subject_type = 'Theory + Practical'
WHERE subject_type = 'Both';

UPDATE subjects
SET theory_hours = CASE
    WHEN theory_hours > 0 THEN theory_hours
    WHEN theory_hours_per_week > 0 THEN theory_hours_per_week
    WHEN subject_type = 'Theory' THEN GREATEST(total_hours, total_hours_semester)
    ELSE 0
END;

UPDATE subjects
SET practical_hours = CASE
    WHEN practical_hours > 0 THEN practical_hours
    WHEN practical_hours_per_week > 0 THEN practical_hours_per_week
    WHEN subject_type = 'Practical' THEN GREATEST(total_hours, total_hours_semester)
    ELSE 0
END;

UPDATE subjects
SET total_hours = CASE
    WHEN total_hours > 0 THEN total_hours
    WHEN total_hours_semester > 0 THEN total_hours_semester
    ELSE theory_hours + practical_hours
END;

UPDATE subjects
SET requires_lab = CASE
    WHEN subject_type = 'Practical' THEN TRUE
    WHEN subject_type = 'Theory + Practical' AND practical_hours > 0 THEN TRUE
    ELSE FALSE
END;

UPDATE subjects
SET theory_hours_per_week = theory_hours,
    practical_hours_per_week = practical_hours,
    total_hours_semester = total_hours;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'subjects_subject_type_check'
    ) THEN
        ALTER TABLE subjects
        DROP CONSTRAINT subjects_subject_type_check;
    END IF;

    ALTER TABLE subjects
    ADD CONSTRAINT subjects_subject_type_check
    CHECK (subject_type IN ('Theory', 'Practical', 'Theory + Practical', 'Both'));
END $$;

CREATE TABLE IF NOT EXISTS faculty_subjects (
    id SERIAL PRIMARY KEY,
    faculty_id INTEGER REFERENCES faculty(id) ON DELETE CASCADE,
    faculty_user_id INTEGER REFERENCES faculty_users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE (faculty_id, subject_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'faculty_subjects'
          AND column_name = 'faculty_user_id'
    ) THEN
        ALTER TABLE faculty_subjects
        ADD COLUMN faculty_user_id INTEGER REFERENCES faculty_users(id) ON DELETE CASCADE;
    END IF;

    ALTER TABLE faculty_subjects
    ALTER COLUMN faculty_id DROP NOT NULL;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_faculty_subjects_owner'
    ) THEN
        ALTER TABLE faculty_subjects
        ADD CONSTRAINT chk_faculty_subjects_owner
        CHECK (
            (faculty_id IS NOT NULL AND faculty_user_id IS NULL)
            OR (faculty_id IS NULL AND faculty_user_id IS NOT NULL)
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    block_name VARCHAR(80) UNIQUE NOT NULL,
    number_of_floors INTEGER NOT NULL CHECK (number_of_floors > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classrooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(30) UNIQUE NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('Lecture', 'Lab')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratories (
    id SERIAL PRIMARY KEY,
    lab_name VARCHAR(80) UNIQUE NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    equipment_type VARCHAR(120),
    lab_duration_preference INTEGER DEFAULT 120 CHECK (lab_duration_preference > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS department_schedule_config (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INTEGER NOT NULL CHECK (slot_duration_minutes > 0),
    break_duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_duration_minutes >= 0),
    break_after_slot_number INTEGER,
    working_days VARCHAR(20) NOT NULL CHECK (working_days IN ('Mon-Fri', 'Mon-Sat', 'Mon-Sun', '5', '6', '7')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_department_schedule_time_window CHECK (end_time > start_time),
    CONSTRAINT chk_department_schedule_break_config CHECK (
        (break_duration_minutes = 0 AND break_after_slot_number IS NULL)
        OR (
            break_duration_minutes > 0
            AND break_after_slot_number IS NOT NULL
            AND break_after_slot_number > 0
        )
    )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'department_schedule_config'
          AND column_name = 'break_after_slot_number'
    ) THEN
        ALTER TABLE department_schedule_config
        ADD COLUMN break_after_slot_number INTEGER;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'department_schedule_config'
          AND column_name = 'break_start_time'
    ) THEN
        UPDATE department_schedule_config
        SET break_after_slot_number = GREATEST(
            1,
            FLOOR(
                EXTRACT(EPOCH FROM (break_start_time - start_time)) / 60
                / NULLIF(slot_duration_minutes, 0)
            )::int
        )
        WHERE break_duration_minutes > 0
          AND break_after_slot_number IS NULL
          AND break_start_time IS NOT NULL
          AND slot_duration_minutes > 0;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_department_schedule_break_window'
    ) THEN
        ALTER TABLE department_schedule_config
        DROP CONSTRAINT chk_department_schedule_break_window;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_department_schedule_break_config'
    ) THEN
        ALTER TABLE department_schedule_config
        DROP CONSTRAINT chk_department_schedule_break_config;
    END IF;

    ALTER TABLE department_schedule_config
    ADD CONSTRAINT chk_department_schedule_break_config
    CHECK (
        (break_duration_minutes = 0 AND break_after_slot_number IS NULL)
        OR (
            break_duration_minutes > 0
            AND break_after_slot_number IS NOT NULL
            AND break_after_slot_number > 0
        )
    );
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'department_schedule_config_working_days_check'
    ) THEN
        ALTER TABLE department_schedule_config
        DROP CONSTRAINT department_schedule_config_working_days_check;
    END IF;

    ALTER TABLE department_schedule_config
    ADD CONSTRAINT department_schedule_config_working_days_check
    CHECK (working_days IN ('Mon-Fri', 'Mon-Sat', 'Mon-Sun', '5', '6', '7'));
END $$;

CREATE TABLE IF NOT EXISTS semester_durations (
    id SERIAL PRIMARY KEY,
    semester_id INTEGER NOT NULL UNIQUE REFERENCES semesters(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS scheduling_parameters (
    id SERIAL PRIMARY KEY,
    class_duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (class_duration_minutes > 0),
    working_days_per_week INTEGER NOT NULL DEFAULT 5 CHECK (working_days_per_week BETWEEN 1 AND 7),
    working_hours_start TIME NOT NULL DEFAULT '09:00',
    working_hours_end TIME NOT NULL DEFAULT '17:00',
    break_duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK (break_duration_minutes >= 0),
    max_classes_per_day INTEGER NOT NULL DEFAULT 6 CHECK (max_classes_per_day > 0),
    lab_session_duration INTEGER NOT NULL DEFAULT 120 CHECK (lab_session_duration > 0),
    special_fixed_slots JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_number INTEGER NOT NULL CHECK (slot_number > 0),
    CONSTRAINT uq_time_slots_department_day_slot UNIQUE (department_id, day_of_week, slot_number)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'time_slots'
          AND column_name = 'department_id'
    ) THEN
        ALTER TABLE time_slots
        ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'time_slots_day_of_week_slot_number_key'
    ) THEN
        ALTER TABLE time_slots
        DROP CONSTRAINT time_slots_day_of_week_slot_number_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_time_slots_department_day_slot'
    ) THEN
        ALTER TABLE time_slots
        ADD CONSTRAINT uq_time_slots_department_day_slot
        UNIQUE (department_id, day_of_week, slot_number);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS timetables (
    id SERIAL PRIMARY KEY,
    version_name VARCHAR(80) NOT NULL,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    generated_by INTEGER REFERENCES faculty_users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timetable_history (
    id SERIAL PRIMARY KEY,
    version_name VARCHAR(80) NOT NULL,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    pdf_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timetable_entries (
    id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
    timeslot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    session_mode VARCHAR(20) NOT NULL DEFAULT 'Theory' CHECK (session_mode IN ('Theory', 'Practical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_timetable_entries_faculty_slot UNIQUE (timetable_id, faculty_id, timeslot_id),
    CONSTRAINT uq_timetable_entries_room_slot UNIQUE (timetable_id, classroom_id, timeslot_id),
    CONSTRAINT uq_timetable_entries_section_slot UNIQUE (timetable_id, section_id, timeslot_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'timetable_entries'
          AND column_name = 'session_mode'
    ) THEN
        ALTER TABLE timetable_entries
        ADD COLUMN session_mode VARCHAR(20);

        UPDATE timetable_entries te
        SET session_mode = CASE
            WHEN c.room_type = 'Lab' THEN 'Practical'
            ELSE 'Theory'
        END
        FROM classrooms c
        WHERE te.classroom_id = c.id;

        ALTER TABLE timetable_entries
        ALTER COLUMN session_mode SET DEFAULT 'Theory';

        UPDATE timetable_entries
        SET session_mode = 'Theory'
        WHERE session_mode IS NULL;

        ALTER TABLE timetable_entries
        ALTER COLUMN session_mode SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'timetable_entries_session_mode_check'
    ) THEN
        ALTER TABLE timetable_entries
        DROP CONSTRAINT timetable_entries_session_mode_check;
    END IF;

    ALTER TABLE timetable_entries
    ADD CONSTRAINT timetable_entries_session_mode_check
    CHECK (session_mode IN ('Theory', 'Practical'));

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'timetable_entries_faculty_id_timeslot_id_key'
    ) THEN
        ALTER TABLE timetable_entries
        DROP CONSTRAINT timetable_entries_faculty_id_timeslot_id_key;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'timetable_entries_classroom_id_timeslot_id_key'
    ) THEN
        ALTER TABLE timetable_entries
        DROP CONSTRAINT timetable_entries_classroom_id_timeslot_id_key;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'timetable_entries_section_id_timeslot_id_key'
    ) THEN
        ALTER TABLE timetable_entries
        DROP CONSTRAINT timetable_entries_section_id_timeslot_id_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_timetable_entries_faculty_slot'
    ) THEN
        ALTER TABLE timetable_entries
        ADD CONSTRAINT uq_timetable_entries_faculty_slot
        UNIQUE (timetable_id, faculty_id, timeslot_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_timetable_entries_room_slot'
    ) THEN
        ALTER TABLE timetable_entries
        ADD CONSTRAINT uq_timetable_entries_room_slot
        UNIQUE (timetable_id, classroom_id, timeslot_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_timetable_entries_section_slot'
    ) THEN
        ALTER TABLE timetable_entries
        ADD CONSTRAINT uq_timetable_entries_section_slot
        UNIQUE (timetable_id, section_id, timeslot_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    approved_by INTEGER REFERENCES faculty_users(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('Approved', 'Rejected')),
    comments TEXT,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recent_activity (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES faculty_users(id) ON DELETE SET NULL,
    action_type VARCHAR(80) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_faculty_user_id ON otp_verifications(faculty_user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_id ON password_reset_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expiry_time ON password_reset_otps(expiry_time);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_faculty_user_id ON password_reset_tokens(faculty_user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry_time ON password_reset_tokens(expiry_time);
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_admin_user
ON faculty_users ((LOWER(role)))
WHERE LOWER(role) = 'admin';
CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_name
ON departments ((LOWER(department_name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_name_per_department
ON branches (department_id, (LOWER(branch_name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_code_per_department
ON branches (department_id, (LOWER(branch_code)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_name_per_branch
ON sections (branch_id, (LOWER(section_name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_code_per_branch
ON subjects (branch_id, (LOWER(subject_code)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_department_schedule_config_department
ON department_schedule_config (department_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_semester_durations_semester
ON semester_durations (semester_id);
CREATE INDEX IF NOT EXISTS idx_faculty_departments_faculty_user_id ON faculty_departments(faculty_user_id);
CREATE INDEX IF NOT EXISTS idx_faculty_departments_department_id ON faculty_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_subjects_faculty_id ON faculty_subjects(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_subjects_subject_id ON faculty_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_faculty_subjects_faculty_user_id ON faculty_subjects(faculty_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_faculty_subjects_faculty_user_subject
ON faculty_subjects(faculty_user_id, subject_id)
WHERE faculty_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timetable_entries_timeslot_id ON timetable_entries(timeslot_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_section_id ON timetable_entries(section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_subject_id ON timetable_entries(subject_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_faculty_id ON timetable_entries(faculty_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_department_id ON time_slots(department_id);
CREATE INDEX IF NOT EXISTS idx_timetable_history_created_at ON timetable_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_activity_created_at ON recent_activity(created_at DESC);
