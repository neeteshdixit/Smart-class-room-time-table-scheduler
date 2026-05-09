# Operational Workflow Process: NexusAI

This document provides a granular, step-by-step breakdown of how the NexusAI ecosystem operates in a real-world academic environment. It is divided into four critical operational phases.

---

## Phase 1: Institutional Onboarding & Data Ingestion
*Goal: Establishing the "Digital Twin" of the institution.*

1.  **Data Discovery:** Administrators upload CSV/Excel files containing Faculty directories, Room inventories, and Subject curriculum maps.
2.  **Constraint Definition:**
    - **Faculty Constraints:** Marking "unavailable" slots and subject expertise.
    - **Infrastructure Constraints:** Tagging rooms as "Lab" or "Theory" and setting capacity limits.
    - **Policy Constraints:** Defining institutional rules (e.g., "No classes after 5 PM on Fridays").
3.  **Data Validation:** The AI checks for consistency (e.g., "Is a subject assigned to a faculty who isn't expert in it?").

---

## Phase 2: The AI Generation Loop
*Goal: Creating a mathematically optimal, conflict-free master timetable.*

1.  **Initialization:** The Admin selects the target Semester and Department and clicks "AI Generate."
2.  **Genetic Algorithm Execution:**
    - **Population Creation:** The engine generates thousands of random valid schedules.
    - **Fitness Scoring:** Each schedule is scored based on "Hard" and "Soft" constraints.
    - **Iteration:** The best performers are "crossed over" and "mutated" to find an even better version.
3.  **Simulation Review:** The system presents a "Draft Timetable" with a detailed Conflict Analysis report.
4.  **Admin Refinement:** The Admin can manually override specific slots or ask the **AI Chatbot** to adjust them (e.g., *"Swap Section A and B's labs"*).
5.  **Final Commitment:** Once the "Optimization Score" is satisfactory, the Admin publishes the schedule.

---

## Phase 3: Daily Dynamic Management
*Goal: Handling real-time changes without disrupting the entire system.*

1.  **Absence Reporting:** A faculty member reports an absence through the Mobile App or Chatbot.
2.  **AI Substitution Engine:**
    - **Step A:** Identify affected classes.
    - **Step B:** Search for available faculty with matching subject expertise.
    - **Step C:** Suggest the top 3 optimal substitutes to the Admin.
3.  **One-Click Approval:** The Admin approves a suggestion.
4.  **Automatic Rescheduling:** The system updates the master database instantly.
5.  **Conflict Re-Check:** The engine runs a background check to ensure the new change hasn't created a hidden clash elsewhere.

---

## Phase 4: Communication & Sync
*Goal: Keeping all stakeholders informed in real-time.*

1.  **Push Notifications:** When a class is swapped or cancelled, students of the affected section receive an instant mobile push alert.
2.  **Personalized Dashboards:**
    - **Faculty:** Sees their updated daily agenda with "Substitute" tags if they are covering for someone.
    - **Student:** Sees their specific section's timetable with real-time "Cancelled/Room Changed" status.
3.  **Live TV/Kiosk Sync:** Public displays in hallways are automatically updated via the system's WebSocket layer.
4.  **Audit Logging:** Every action is recorded in the Audit Log for end-of-semester reporting and analytics.

---

## Phase 5: AI Chatbot (Agentic Interaction)
*Goal: Natural Language as the Primary Interface.*

1.  **Query Handling:**
    - *User:* "Is Room 201 free right now?"
    - *AI:* Queries DB -> Checks current time slot -> Answers "Yes, it is free until 2 PM."
2.  **Action Handling:**
    - *User:* "Mark Prof. Khanna as on leave today."
    - *AI:* Finds affected slots -> Identifies substitutes -> Asks Admin for approval -> Updates Timetable.
3.  **Contextual Insights:**
    - *User:* "Why is there a gap in Section C's Wednesday schedule?"
    - *AI:* Analyzes constraints -> Explains "Section C has a specialized Lab that required this specific window."
