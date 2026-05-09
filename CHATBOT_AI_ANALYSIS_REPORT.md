# Chatbot AI Analysis Report

Project: Smart Classroom Timetable Scheduler  
Scope: Existing chatbot UI, backend routes, API flow, and AI logic

## What Already Exists

- A floating chatbot UI in [`frontend/src/components/AIChatbot.jsx`](frontend/src/components/AIChatbot.jsx).
- Auth-protected chatbot access through the app shell in [`frontend/src/App.jsx`](frontend/src/App.jsx).
- A legacy chat route at [`backend/src/routes/chatRoutes.js`](backend/src/routes/chatRoutes.js).
- A broader AI route module in [`backend/src/routes/aiRoutes.js`](backend/src/routes/aiRoutes.js).
- Chat history persistence through the `chat_history` table in [`backend/src/db/schema.sql`](backend/src/db/schema.sql).
- Existing timetable, faculty, student, master-data, and dashboard APIs that the chatbot can reuse.

## What Was Broken

- The backend chatbot brain was still tied to legacy Gemini/OpenAI assumptions in [`backend/src/services/aiService.js`](backend/src/services/aiService.js).
- The current chat flow depended on fallback guides when external keys were missing, so it was not a true local AI assistant.
- The frontend was only calling `/chat`, while the requested target flow was `/api/ai/chat`.
- The chatbot had no local Ollama health check or service-status feedback.
- The UI was functional but generic, with no explicit typing effect, local AI status, or quick-action guidance.

## What Should Be Reused

- The authenticated app shell and floating launcher.
- The existing `chat_history` table and rate limiting.
- Role-aware backend context from faculty, student, timetable, dashboard, and master-data routes.
- Existing timetable generation and conflict-report logic.
- The current glassmorphism visual language and motion stack.

## What Should Be Replaced

- Replace the legacy Gemini/OpenAI-centric AI service with a local Ollama adapter.
- Replace the chatbot's generic fallback-first behavior with a domain-restricted assistant flow.
- Replace the barebones single-endpoint frontend call with an explicit `/api/ai/chat` contract.
- Replace the chatbot UI with a richer assistant surface that includes loading states, typing animation, and quick actions.

## What Should Not Be Touched

- Timetable generation logic outside the chatbot integration path.
- Auth, JWT, profile, and role gating.
- Existing master-data and timetable CRUD APIs that already work.
- The database schema outside of chatbot history metadata use.
- The current app layout and route structure beyond the chatbot entry points.

## Implementation Direction

- Use Ollama locally on `http://127.0.0.1:11434`.
- Prefer `llama3.2:1b` on lower-memory machines and `llama3.2` on larger ones.
- Add strict intent filtering before the model sees a prompt.
- Support English, Hindi, and Hinglish with same-language replies.
- Keep responses domain-restricted to timetable and academic workflows.
- Keep unrelated prompts polite and humorous, but firmly refused.

## Notes

- Ollama is installed locally on this machine, and the chatbot now has a downloaded `llama3.2:1b` model available for the default runtime path.
- The local Ollama server is reachable at `http://127.0.0.1:11434`, and the backend health probe can confirm installed models.
- The codebase already has enough backend data to power a good timetable assistant without duplicating APIs.
