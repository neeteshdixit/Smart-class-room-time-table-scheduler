# Project Analysis Report

Date: 2026-04-05  
Project: Smart Classroom Time Table Scheduler  
Scope: Static codebase analysis (no live runtime/integration execution in this pass)

## Executive Summary

This project is a full-stack timetable scheduling platform built with:

- Backend: Node.js, Express, PostgreSQL
- Frontend: Static HTML/CSS + vanilla JavaScript + Bootstrap
- Auth: JWT + OTP via email
- Scheduler: Constraint-driven timetable generation with conflict detection, fallback behavior, and PDF history

The project has strong domain functionality and a robust schema, but there are a few high-impact behavioral issues in timetable generation and faculty download flow that should be addressed first.

## Codebase Shape

Top-heavy files (maintenance risk due to size/complexity):

- `src/routes/timetableRoutes.js` (~3792 lines)
- `src/routes/dashboardDataRoutes.js` (~1955 lines)
- `public/js/dashboard.js` (~1957 lines)

Core backend entrypoints:

- `server.js`
- `src/app.js`
- `src/routes/index.js`

Schema + migrations:

- `src/db/schema.sql`
- `src/db/initializeSchema.js`

## Architecture Overview

### Backend

- Server startup validates DB connectivity and auto-initializes schema:
  - `server.js:24`
  - `server.js:25`
- Express app serves:
  - static frontend (`public/`)
  - uploaded files (`/uploads`)
  - API routes under `/api`
  - `src/app.js:64`
  - `src/app.js:65`
  - `src/app.js:66`
- Main route groups:
  - auth, profile, stats, master data, timetable, faculty, dashboard management
  - `src/routes/index.js:12`
  - `src/routes/index.js:18`

### Frontend

- Multi-page static app (`public/*.html`) with page-specific JS in `public/js`.
- Shared request/auth helper in `public/js/common.js`.
- Admin dashboard and faculty timetable views are separate flows.

### Data Model

- Good use of constraints and indexes in `src/db/schema.sql`.
- Timetable clash prevention via unique constraints:
  - `(timetable_id, faculty_id, timeslot_id)`
  - `(timetable_id, classroom_id, timeslot_id)`
  - `(timetable_id, section_id, timeslot_id)`
  - `src/db/schema.sql:604`
  - `src/db/schema.sql:605`
  - `src/db/schema.sql:606`

## Strengths

1. Domain-rich scheduler implementation with practical/theory handling, fallback strategies, conflict summaries, and PDF history.
2. Role-based access controls are present and consistently used in most route modules.
3. Schema has strong relational design with useful indexes and defensive constraints.
4. OTP responses avoid returning OTP values directly.
5. Frontend API base fallback strategy supports split deployments.

## Findings (Prioritized)

## High

### 1) `auto_room_expansion` flag is parsed but not honored

Issue:

- Request flag `auto_room_expansion` is parsed, but room auto-creation still runs whenever not simulation.

Evidence:

- Parsed flag:
  - `src/routes/timetableRoutes.js:1095`
- Auto room creation path (no check against parsed flag before execution):
  - `src/routes/timetableRoutes.js:1214`
- API validation includes the flag:
  - `src/routes/timetableRoutes.js:3861`
- README claims this behavior is toggleable:
  - `README.md:159`

Impact:

- Unexpected persisted infrastructure changes even when caller intends no auto expansion.

Recommendation:

- Gate auto-room creation using `autoRoomExpansion` before invoking room generation helpers.

### 2) Simulation mode can still mutate DB through separate clients

Issue:

- Even in simulation mode, writes can occur via separate DB clients for slot/faculty synchronization, while only the main transaction is rolled back.

Evidence:

- Simulation response rollback:
  - `src/routes/timetableRoutes.js:3496`
- Separate client used for time-slot upsert/delete:
  - `src/routes/timetableRoutes.js:1263`
  - Write logic in helper:
  - `src/routes/timetableRoutes.js:395`
- Separate client used for faculty directory sync:
  - `src/routes/timetableRoutes.js:1287`

Impact:

- “Dry run” is not strictly dry; can leave side effects.

Recommendation:

- For simulation mode, skip all side-effecting helper calls or route all operations through one transaction that is guaranteed to roll back.

### 3) Faculty “Download PDF” likely fails due to missing auth header in UI flow

Issue:

- Backend download endpoint requires JWT auth.
- Frontend opens URL in a new tab without Bearer header.

Evidence:

- Protected endpoint:
  - `src/routes/facultyRoutes.js:375`
- Frontend opens direct URL:
  - `public/js/faculty-timetable.js:490`
  - `public/js/faculty-timetable.js:492`

Impact:

- User-facing failure (401/redirect), despite available timetable.

Recommendation:

- Fetch blob with `apiRequest` + auth headers, then trigger download client-side; or issue signed temporary download URLs.

## Medium

### 4) OTP generation/storage security can be strengthened

Issue:

- OTP generated with `Math.random()` and stored in plaintext DB columns.

Evidence:

- Generator:
  - `src/utils/otp.js:1`
- Login OTP DB insert:
  - `src/models/otpModel.js:5`
- Password reset OTP DB insert:
  - `src/models/passwordResetModel.js:20`

Impact:

- Weaker cryptographic quality and higher risk if DB content leaks.

Recommendation:

- Use `crypto.randomInt()` for OTP generation and store hashed OTP values (compare with constant-time checks).

### 5) Profile delete UX does not match backend authorization policy

Issue:

- UI shows delete-account controls broadly, but backend allows only admins to delete this account route.

Evidence:

- UI delete section:
  - `public/profile.html:114`
- Delete handler call:
  - `public/js/profile.js:94`
- Backend admin-only check:
  - `src/routes/profileRoutes.js:137`

Impact:

- Confusing UX for non-admin users.

Recommendation:

- Hide/disable delete section for non-admin users in UI (or adjust backend policy if intended behavior differs).

### 6) Docs drift vs code defaults

Issue:

- README says `faculty_overuse_threshold` default is `2`, code default constant is `3`.

Evidence:

- README:
  - `README.md:162`
- Code:
  - `src/routes/timetableRoutes.js:19`

Impact:

- Operational confusion and inconsistent expectations.

Recommendation:

- Align docs with code or update constant to match documented behavior.

### 7) No automated tests found

Issue:

- No test scripts in `package.json` and no test files detected in repository.

Evidence:

- Scripts:
  - `package.json:6`

Impact:

- Regression risk is high, especially with large scheduling logic.

Recommendation:

- Add baseline tests first for:
  - timetable generation invariants,
  - auth + OTP flow,
  - critical admin/faculty route permissions.

## Low

### 8) Unused session dependencies and partial session usage

Observation:

- `express-session` and `connect-pg-simple` are in dependencies but app-level session middleware is not configured; only logout checks `req.session`.

Evidence:

- Dependencies:
  - `package.json:16`
  - `package.json:20`
- `req.session` check:
  - `src/routes/dashboardDataRoutes.js:329`

Impact:

- Dependency bloat/confusion.

Recommendation:

- Either fully wire session middleware or remove unused session dependencies and session-specific code path.

### 9) Mixed-language comments and encoding artifacts

Observation:

- A few comments in `timetableRoutes.js` contain non-ASCII/Hinglish text and mojibake-like artifacts.

Evidence:

- `src/routes/timetableRoutes.js:3321`
- `src/routes/timetableRoutes.js:3339`

Impact:

- Readability and maintainability concern.

Recommendation:

- Normalize comments to clear, consistent English and UTF-8-safe text.

## Suggested Refactor Plan

Phase 1 (stability):

1. Fix `auto_room_expansion` gating.
2. Make simulation path strictly side-effect free.
3. Fix faculty PDF download auth flow.
4. Align README defaults.

Phase 2 (quality):

1. Break `timetableRoutes.js` into service modules:
   - precheck
   - slot generation
   - allocation engine
   - export/history
2. Break `dashboardDataRoutes.js` by resource domain.
3. Extract shared validation/util modules.

Phase 3 (test coverage):

1. Unit tests for scheduling helper functions.
2. Integration tests for generate/simulate endpoints.
3. Auth/role route tests.

## Conclusion

This is a feature-rich and practical scheduler system with strong schema foundations.  
Addressing the three high-priority findings will significantly improve correctness and user reliability, and adding a minimal test suite will reduce long-term regression risk.

