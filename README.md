# Faculty Authentication System for Timetable Scheduler

Node.js + Express + PostgreSQL implementation for:
- University landing page
- Role-based signup (Faculty/Admin) with duplicate checks
- Profile photo upload using Multer
- Multi-department and multi-subject selection during signup
- Login + OTP verification
- Forgot password with email OTP verification
- Faculty dashboard + profile management
- Academic/infrastructure master data APIs
- Timetable generation + approval + reports
- Redesigned React frontend in `frontend/`

## Tech Stack
- Frontend: React + Tailwind CSS + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: `bcryptjs` + JWT + Nodemailer SMTP

## Project Structure
```text
.
|-- frontend/                # React + Tailwind redesign
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

Important: keep `.env` local only (do not commit it). In Render/production, set env vars in the platform dashboard.

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

6. Start the React frontend:
```bash
npm run dev:frontend
```

7. Open:
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
PASSWORD_RESET_OTP_EXPIRES_MINUTES=5
PASSWORD_RESET_OTP_MAX_ATTEMPTS=5
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_TIMEOUT_MS=15000
SMTP_USER=your_smtp_user@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM=no-reply@example.com
PUBLIC_API_BASE_URL=
CORS_ORIGIN=*
```

`PUBLIC_API_BASE_URL` is optional. Set it when frontend and backend run on different domains, e.g.
`https://your-backend-domain.com/api`.

For Render deployment, set `DATABASE_URL` in the Render service environment (do not rely on repo `.env`).

## Core APIs

### Authentication
- `GET /api/auth/signup-meta`
- `GET /api/auth/check-admin`
- `GET /api/auth/signup-options`
- `POST /api/auth/signup`
- `POST /api/auth/admin-signup`
- `POST /api/auth/login`
- `POST /api/auth/verify-login-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-otp`
- `POST /api/auth/reset-password`

### Profile
- `GET /api/profile`
- `PUT /api/profile`
- `DELETE /api/profile/delete-account`

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

`POST /api/timetable/generate` supports optional `faculty_assignment_overrides`:
```json
[
  { "section_id": 1, "subject_id": 10, "faculty_id": 5 }
]
```
This locks a single faculty for each `(section_id, subject_id)` pair across all generated slots.

Optional payload flags:
- `auto_room_expansion` (`true/false`, default `true`) to auto-create fallback lecture rooms when sections exceed available room capacity.
  This creation is persisted, so generated fallback rooms remain available for future runs.
- `reuse_saved_faculty_assignments` (`true/false`, default `false`) to reuse `subject_faculty_assignment` from earlier runs.
- `faculty_overuse_threshold` (`0-20`, default `2`) to control how far a faculty load can exceed average before lower-priority selection.

### Faculty View (Read-Only)
- `GET /api/faculty/timetable`

## OTP Behavior
- All OTPs are delivered only to the registered email address.
- OTP values are never returned in API responses.

## SMTP Troubleshooting
- If forgot-password stays on "Sending..." for too long, set `SMTP_TIMEOUT_MS` (default `15000`) to fail fast with a clear error.
- Ensure outbound SMTP is allowed from your host/network (typically port `587` or `465`).
- For Gmail SMTP, use an App Password in `SMTP_PASS` with 2-step verification enabled.
- If your Gmail App Password is copied with spaces (e.g. `abcd efgh ijkl mnop`), it is normalized automatically.

## Deployment Troubleshooting
- If UI shows `Request failed` or `API route not found (404)`, open the failed request URL in browser devtools and verify it points to your backend, not only your frontend host.
- In split deployment (frontend + backend different domains), set `PUBLIC_API_BASE_URL` on backend and redeploy so `/runtime-config.js` provides the correct API base to all pages.
- If forgot-password specifically fails with `502/503/504`, check SMTP env vars and outbound SMTP/network restrictions on your hosting provider.

## Notes
- Roles supported: `ADMIN`, `FACULTY`, `USER`.
- `ADMIN` signup is allowed only when no admin exists; once the admin account is deleted, admin signup is available again.
- Faculty and User can self-register through standard signup.
- Signup accepts `multipart/form-data` with `profile_photo` file upload.
- Selected departments are stored in `faculty_departments`.
- Selected subjects for registered users are stored in `faculty_subjects` using `faculty_user_id`.
- Login access is available for `Admin`, `Faculty`, and `Student` roles.
- `POST /api/generate-timetable` and `/api/timetable/*` management endpoints are `Admin` only.
- Faculty users can only view assigned timetable via `GET /api/faculty/timetable`.
- Account deletion requires JWT auth + password confirmation and writes an entry in `recent_activity`.
- Forgot password uses `password_reset_otps` with 5-minute expiry, attempt limiting, and one-time usage.
- Timetable generator is a functional greedy allocator (practicals/theory by constraints).
- Timetable generation now enforces one faculty per `(section, subject)` for consistency.
- Faculty allocation is load-balanced using workload ratio, daily class limits, and slot availability checks.
- Faculty distribution for the same subject is section-wise round-robin to avoid one faculty capturing all sections.
- Session assignment uses section-aware round-robin ordering to improve fill rate for newly added sections.
- Optional persistent mappings are stored in `subject_faculty_assignment`.
- Unique constraints in `timetable_entries` enforce no faculty/classroom/section clashes.
- `POST /api/master/faculty` is restricted to users with `Admin` role.
- Extend scheduler logic for advanced optimization/AI strategies in future versions.
