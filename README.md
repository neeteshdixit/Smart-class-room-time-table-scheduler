# Faculty Authentication System for Timetable Scheduler

Node.js + Express + PostgreSQL implementation for:
- University landing page
- Role-based signup (Faculty/Admin) with duplicate checks
- Profile photo upload using Multer
- Multi-department and multi-subject selection during signup
- Login + OTP verification (simulated OTP)
- Faculty dashboard + profile management
- Academic/infrastructure master data APIs
- Timetable generation + approval + reports

## Tech Stack
- Frontend: HTML + Bootstrap + Vanilla JS
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: `bcryptjs` + JWT

## Project Structure
```text
.
|-- public/                  # Landing page + auth + dashboard/profile UI
|-- scripts/initDb.js        # Initializes PostgreSQL schema
|-- src/
|   |-- app.js
|   |-- controllers/
|   |-- config/db.js
|   |-- db/schema.sql
|   |-- models/
|   |-- middleware/
|   |-- routes/
|   |-- services/
|   |-- utils/
|-- server.js
```

## Setup
1. Install dependencies:
```bash
npm install
```

2. Copy environment file and update values:
```bash
copy .env.example .env
```

3. Create PostgreSQL database (example):
```sql
CREATE DATABASE smart_scheduler;
```

4. Initialize schema:
```bash
npm run db:init
```

5. Start server:
```bash
npm run dev
```

6. Open:
```text
http://localhost:5000
```

## Environment Variables
Use `.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_scheduler
JWT_SECRET=replace_with_a_secure_random_secret
JWT_EXPIRES_IN=30m
LOGIN_OTP_TOKEN_EXPIRES_IN=10m
CORS_ORIGIN=*
```

## Core APIs

### Authentication
- `GET /api/auth/signup-meta`
- `GET /api/auth/signup-options`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-token`
- `POST /api/auth/reset-password`

### Profile
- `GET /api/profile`
- `PUT /api/profile`

### Dashboard
- `GET /api/stats`

### Master Data (Generic CRUD)
- `GET /api/master/:resource`
- `POST /api/master/:resource`
- `PUT /api/master/:resource/:id`
- `DELETE /api/master/:resource/:id`

Resources:
- `departments`
- `branches`
- `semesters`
- `sections`
- `faculty`
- `subjects`
- `faculty-subjects`
- `blocks`
- `classrooms`
- `laboratories`
- `scheduling-parameters`
- `time-slots`

### Timetable + Reports
- `POST /api/timetable/generate`
- `GET /api/timetable`
- `POST /api/timetable/:id/approval`
- `GET /api/timetable/reports/workload`
- `GET /api/timetable/reports/room-utilization`
- `GET /api/timetable/reports/subject-distribution`
- `GET /api/timetable/reports/conflicts`

## OTP Behavior
- In development mode, login/resend response includes `otp_preview`.
- In production mode, `otp_preview` is hidden.

## Notes
- Roles supported: `ADMIN`, `FACULTY`, `USER`.
- `ADMIN` can only be created by an already logged-in existing `ADMIN` (via JWT).
- Faculty and User can self-register but cannot create admin accounts.
- Signup accepts `multipart/form-data` with `profile_photo` file upload.
- Selected departments are stored in `faculty_departments`.
- Selected subjects for registered users are stored in `faculty_subjects` using `faculty_user_id`.
- Login access is restricted to `Admin` role.
- Forgot password uses a reset token with 10-minute expiry stored in `password_reset_tokens`.
- Timetable generator is a functional greedy allocator (practicals/theory by constraints).
- Unique constraints in `timetable_entries` enforce no faculty/classroom/section clashes.
- `POST /api/master/faculty` is restricted to users with `Admin` role.
- Extend scheduler logic for advanced optimization/AI strategies in future versions.
