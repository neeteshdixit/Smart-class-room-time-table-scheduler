# System Architecture & Workflow: NexusAI Scheduler

This document provides a comprehensive technical overview of the **NexusAI** architecture, detailing the interaction between the frontend, backend, AI optimization engine, and the LLM-powered chatbot assistant.

---

## 1. High-Level System Architecture

NexusAI follows a **Modern Full-Stack Micro-Services Architecture** (conceptually) with a clear separation between the presentation layer, business logic, and the AI orchestration layer.

```mermaid
graph TD
    subgraph Client_Layer [Frontend - React 19 + Vite]
        UI[Admin/Faculty Dashboard]
        Chat[AI Assistant Interface]
        Notify[Push Notification Handler]
    end

    subgraph API_Gateway [Backend - Node.js Express]
        Auth[JWT/OTP Auth]
        Router[API Router]
        Middleware[Validation & Role Checks]
    end

    subgraph Service_Layer [Business Logic]
        SchedEngine[Heuristic Scheduler Engine]
        DataService[Master Data Service]
        ExportService[PDF/Excel Generator]
    end

    subgraph AI_Orchestration [AI Agent Layer]
        LLM[LLM - GPT-4o/Claude 3.5]
        RAG[Agentic RAG Engine]
        VectorStore[ChromaDB/Pinecone - Optional for Docs]
    end

    subgraph Persistence_Layer [Database]
        PostgreSQL[(PostgreSQL - Relational Data)]
        Redis[(Redis - Caching & OTP)]
    end

    UI <--> Router
    Chat <--> RAG
    RAG <--> LLM
    RAG <--> PostgreSQL
    Router <--> Service_Layer
    Service_Layer <--> PostgreSQL
    Service_Layer <--> Redis
```

---

## 2. Core Workflow: Timetable Generation

This flow describes how the system moves from "Constraint Definition" to a "Persisted Master Timetable."

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant SchedEngine
    participant DB

    Admin->>API: Initiates "Generate Timetable"
    API->>DB: Fetches Constraints (Faculty, Rooms, Subjects)
    DB-->>API: Returns Master Data
    API->>SchedEngine: Executes Genetic Algorithm / Heuristics
    loop Optimization
        SchedEngine->>SchedEngine: Mutation, Crossover, Fitness Scoring
    end
    SchedEngine-->>API: Returns Optimized Simulation
    API->>Admin: Displays Simulation + Conflict Score
    Admin->>API: Confirms & Saves
    API->>DB: Persists Timetable Slots
    API->>DB: Triggers Audit Log
    API-->>Admin: "Master Timetable Published"
```

---

## 3. AI Chatbot Workflow: Agentic RAG

The chatbot doesn't just "talk"—it acts as a **Natural Language Interface** to the database.

```mermaid
flowchart LR
    User[User Input] --> LLM_Intent[LLM Intent Analysis]
    LLM_Intent -->|Query| DB_Query[Tool: SQL Query Generator]
    LLM_Intent -->|Action| DB_Mutation[Tool: Schedule Mutation Agent]
    
    DB_Query --> PG[(PostgreSQL)]
    DB_Mutation --> PG
    
    PG --> Context[Data Results]
    Context --> LLM_Response[LLM Synthesis]
    LLM_Response --> Final[Natural Language Answer]
```

### Workflow Steps:
1. **Input Analysis:** The LLM analyzes the user's prompt (e.g., *"Is Room 102 free on Monday at 10 AM?"*).
2. **Tool Selection:** The AI Agent selects the appropriate tool (e.g., `get_room_availability`).
3. **Execution:** The agent executes a structured SQL query against the PostgreSQL database.
4. **Synthesis:** The raw data is sent back to the LLM to be formatted into a human-friendly response.
5. **Mutation Confirmation (Optional):** For actions like *"Cancel the class,"* the agent requests confirmation before executing the DB write.

---

## 4. Component Breakdown

### 4.1 Frontend (React 19 + TailwindCSS v4)
- **State Management:** Zustand for real-time UI updates.
- **Components:** Modular Atomic Design (Atoms, Molecules, Organisms).
- **Communication:** Axios/Fetch with interceptors for JWT Bearer tokens.

### 4.2 Backend (Node.js + Express v5)
- **Architecture:** MVC (Model-View-Controller) pattern.
- **Security:** Helmet.js, CORS, and Rate Limiting.
- **Validation:** Zod for schema-based request validation.

### 4.3 Database (PostgreSQL)
- **Relational Integrity:** Strong foreign key constraints to prevent orphaned slots.
- **Indexing:** Optimized indexes on `timeslot_id`, `faculty_id`, and `room_id` for sub-second query performance.
- **Concurrency:** Transactional isolation to prevent race conditions during simultaneous edits.

### 4.4 Notification Engine
- **Push:** Web Push API for browser-based alerts.
- **Email:** Nodemailer with Amazon SES or SendGrid integration.
- **Trigger:** Webhooks triggered by Database listeners (via `NOTIFY/LISTEN` in PG or App-level hooks).

---

## 5. Deployment & Scalability

- **Containerization:** Docker for consistent dev/prod environments.
- **CI/CD:** GitHub Actions for automated testing and deployment.
- **Infrastructure:** Vercel (Frontend) + Render/Heroku/DigitalOcean (Backend) + Supabase/Neon (Managed PostgreSQL).
- **Caching:** Redis for storing transient OTPs and frequently accessed dashboard stats.

---

## 6. Detailed Presentation Diagrams

### 6.1 End-to-End User Journey (The "Explain-to-Judge" Flow)
This diagram helps explain the lifecycle of a scheduling cycle from an administrator's perspective.

```mermaid
journey
    title A Day in the Life of a NexusAI Admin
    section Initialization
      Define Departments: 5: Admin
      Upload Faculty List: 4: Admin, System
      Tag Rooms with IoT/Features: 3: Admin
    section AI Generation
      Set Constraints: 5: Admin
      AI Draft Generation: 5: AI Engine
      Conflict Resolution: 4: Admin, AI Chatbot
    section Real-time Management
      Publish Schedule: 5: System
      Faculty Absence Reported: 3: Faculty
      AI Suggests Substitute: 5: AI Assistant
      One-click Notify Students: 5: System
```

### 6.2 Data Relationship Overview (The "Brain" Structure)
How different data entities connect to form the intelligent core.

```mermaid
erDiagram
    INSTITUTION ||--o{ DEPARTMENT : "has"
    DEPARTMENT ||--o{ FACULTY : "employs"
    DEPARTMENT ||--o{ SUBJECT : "offers"
    DEPARTMENT ||--o{ SECTION : "contains"
    SECTION ||--o{ TIMETABLE_SLOT : "follows"
    FACULTY ||--o{ TIMETABLE_SLOT : "teaches"
    ROOM ||--o{ TIMETABLE_SLOT : "hosts"
    TIMETABLE_SLOT ||--o{ AUDIT_LOG : "tracked_by"
    AI_AGENT ||--o{ CHAT_HISTORY : "manages"
    CHAT_HISTORY }|--|| USERS : "belongs_to"
```

### 6.3 Infrastructure & Cloud Deployment (The "Stack" View)
The physical/cloud layer where the application lives.

```mermaid
graph LR
    User((User)) --> CDN[Vercel Edge / Cloudflare]
    CDN --> Web[React Frontend]
    Web --> API[Node.js API - Docker Container]
    
    subgraph Cloud_Infrastructure
        API --> PG[(Managed PostgreSQL)]
        API --> Redis[(Redis Cache)]
        API --> AI_Cloud[OpenAI / Anthropic API]
    end
    
    subgraph Services
        API --> Mail[Email Service]
        API --> Push[WebPush Service]
        API --> Log[CloudWatch / Logging]
    end
```

### 6.4 The "Smart" Scheduler Engine Deep-Dive
How the AI actually "thinks" when creating the schedule.

```mermaid
flowchart TD
    Start([Start Generation]) --> Ingest[Fetch constraints & Master Data]
    Ingest --> Initial[Create Random Initial Population]
    
    subgraph GA_Loop [Genetic Algorithm Optimization]
        Fit[Calculate Fitness Score: Hard/Soft Constraints] --> Select[Selection: Keep best performers]
        Select --> Cross[Crossover: Mix top schedules]
        Cross --> Mutate[Mutation: Randomize small changes]
        Mutate --> Fit
    end
    
    Fit --> Threshold{Score > 98%?}
    Threshold --No--> GA_Loop
    Threshold --Yes--> Export[Generate JSON/PDF Artifacts]
    Export --> End([Ready for Review])
```

---

## 7. Key Talking Points for Presentation

1. **Conflict-Free Guarantee:** Our heuristic engine ensures 100% adherence to "Hard Constraints" like faculty availability and room capacity.
2. **Cognitive Interface:** The chatbot isn't a simple FAQ; it's a **Functional Agent** that can read and write to the database using natural language.
3. **Reactive Intelligence:** The system doesn't just build a schedule; it manages the *changes* (absences, room failures) in real-time.
4. **Data-Driven ROI:** By optimizing space usage, the institution can potentially save 15-20% on infrastructure expansion needs.

---

## 8. Premium Visual Architecture Overview

![NexusAI Architecture Overview](file:///C:/Users/LENOVO/.gemini/antigravity/brain/cc47bf0b-96d2-4d0b-a095-e58d80256466/nexus_ai_architecture_overview_1778140721076.png)
*Figure 1: High-level visual representation of the NexusAI neural architecture and data ecosystem.*

---

## 9. Integrated AI & Scheduler Workflow (The "Loop")

This diagram shows how the User, Chatbot, and Scheduler Engine work in a single unified loop to manage the institutional logistics.

```mermaid
graph TD
    User([User Request]) --> Chat[LLM Chatbot Interface]
    Chat --> Intent{Intent Analysis}
    
    Intent -->|Direct Query| RAG[Agentic RAG Engine]
    Intent -->|Scheduling Command| Logic[Business Logic Layer]
    
    RAG <--> DB[(PostgreSQL Master Data)]
    
    Logic --> Engine[Heuristic Scheduler Engine]
    Engine --> Simulation[Conflict-Free Simulation]
    Simulation --> Confirm{Admin Confirmation}
    
    Confirm -->|Approve| Persist[Commit to DB]
    Confirm -->|Refine| Chat
    
    Persist --> Notify[Real-time Notification Engine]
    Notify --> Stakeholders[Faculty & Students]
    
    DB --> Analytics[Dashboard Charts & Heatmaps]
    Analytics --> User
```

### Flow Breakdown for Pitching:
1.  **Natural Interaction:** The user talks to the system via the Chatbot.
2.  **Intelligence Layer:** The LLM decides if the user wants information (Query) or action (Command).
3.  **Engine Execution:** Actions are sent to the Scheduler Engine which runs the Genetic Algorithm to find the best solution.
4.  **Human-in-the-Loop:** No changes are made to the live timetable without Admin approval of the "Simulation."
5.  **Instant Synchronization:** Once approved, the system updates the DB and sends push notifications to everyone affected.
