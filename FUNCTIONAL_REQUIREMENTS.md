# Functional Requirements Document: NexusAI Scheduler

This document outlines the detailed functional requirements for the **NexusAI Smart Academic Scheduling Ecosystem**. Each requirement is designed to be actionable, testable, and aligned with the overarching goal of reducing administrative overhead through AI.

---

## 1. User Management & Authentication (FR-01)

### 1.1 Multi-Role Authentication
- **Requirement:** The system must support three distinct user roles: **Super Admin**, **Faculty**, and **Student**.
- **User Story:** As a user, I want to log in securely using my institutional email and an OTP so that my data remains protected.
- **Acceptance Criteria:**
    - Integration with SMTP for OTP delivery.
    - JWT-based session management with a 24-hour expiry.
    - Role-based redirection upon successful login.

### 1.2 Profile Management
- **Requirement:** Users must be able to manage their profiles, including contact details and specialized preferences.
- **Details:** 
    - Faculty can specify their "Expertise Subjects" and "Unavailable Hours."
    - Admins can manage account status (Active/Suspended).

---

## 2. Master Data Management (FR-02)

### 2.1 Institutional Hierarchy
- **Requirement:** Admins must be able to define the organizational structure.
- **Details:** CRUD operations for Departments, Sections, and Semester cycles.

### 2.2 Resource Inventory (Rooms & Labs)
- **Requirement:** The system must track physical infrastructure capacity and equipment.
- **Details:**
    - Define Room Type: Theory, Lab, or Smart Classroom.
    - Specify Capacity: Maximum student count.
    - Feature Tags: Projector, High-end PCs, AC, etc.

### 2.3 Subject & Curriculum Mapping
- **Requirement:** Define subjects with credit hours and required room types.
- **Details:** 
    - Map subjects to specific departments.
    - Define "Double-slot" requirements for practical labs.

---

## 3. AI-Driven Timetable Generation (FR-03)

### 3.1 Automated Allocation Engine
- **Requirement:** The system must generate a full weekly timetable based on a "Genetic Algorithm" or "Constraint Satisfaction" approach.
- **Hard Constraints (Must Not Break):**
    - No faculty can be in two places at once.
    - No classroom can have two classes at once.
    - No section can have two classes at once.
- **Soft Constraints (Target to Minimize):**
    - Avoid faculty having more than 3 consecutive hours.
    - Minimize "gap hours" for both faculty and students.
    - Prioritize early-morning slots for core subjects.

### 3.2 Simulation Mode
- **Requirement:** Admins must be able to "Simulate" a schedule without persisting it to the database to check for efficiency scores.
- **Acceptance Criteria:** Return a "Conflict Report" and "Optimization Score" before saving.

---

## 4. LLM-Based AI Chatbot Assistant (FR-04)

### 4.1 Natural Language Querying (NLQ)
- **Requirement:** Users can ask questions about the schedule in plain English.
- **Examples:** 
    - "Where is Prof. Rajesh teaching at 11 AM today?"
    - "Which labs are free on Friday afternoon?"
- **Acceptance Criteria:** Responses must be fetched from the live database using Agentic RAG.

### 4.2 Conversational Mutations
- **Requirement:** Admins can modify the schedule via the chatbot.
- **Example:** "Cancel all classes for Section B tomorrow and notify them."
- **Acceptance Criteria:** The system must perform the action and trigger real-time notifications.

---

## 5. Intelligent Substitution System (FR-05)

### 5.1 Real-time Faculty Absence Handling
- **Requirement:** When a faculty member reports an absence, the AI must suggest the top 3 best substitutes.
- **Selection Logic:**
    - **Step 1:** Check expertise in the subject.
    - **Step 2:** Check for free slots in the substitute's schedule.
    - **Step 3:** Check for proximity (same department).

### 5.2 One-Click Swap
- **Requirement:** Approve a substitution with one click, automatically updating the timetable and notifying affected students.

---

## 6. Dashboard & Analytics (FR-06)

### 6.1 Administrator Command Center
- **Visuals:** 
    - Real-time heatmaps for room utilization.
    - Faculty workload distribution charts.
    - "Conflict Watchlist" for edge cases.

### 6.2 Personal Timetable View
- **Requirement:** Mobile-responsive grid view for Faculty and Students.
- **Details:** Distinct indicators for "Theory" vs "Lab" and "Rescheduled" classes.

---

## 7. Reporting & Data Export (FR-07)

### 7.1 Multi-format Export
- **Requirement:** Export individual or master timetables to PDF and Excel.
- **Details:** Include institution branding and time-stamps.

### 7.2 Audit Logs
- **Requirement:** Track every manual change made to the schedule, including who made it and when.

---

## 8. Notifications & Alerts (FR-08)

### 8.1 Instant Sync
- **Requirement:** Push notifications or email alerts for:
    - Schedule changes made within 24 hours of the slot.
    - New substitution requests.
    - Approvals/Rejections of leave requests.

---

## 9. Performance & Scalability (FR-09)

### 9.1 Generation Benchmarks
- **Requirement:** Generate a conflict-free schedule for 1,000+ slots in under 60 seconds.
- **Concurrency:** Support 50+ concurrent users querying the AI chatbot.

---

## 10. Accessibility & Localization (FR-10)

### 10.1 Inclusive Design
- **Requirement:** WCAG 2.1 AA compliance for the entire UI.
- **Localization:** Support for English and at least one regional language (AI-translated).
