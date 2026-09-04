# Capacity Connect

AI-powered digital capacity building & learning management portal for the Ministry of Earth Sciences (Smart India Hackathon 2026 — problem SIH26075).

## Stack

- React 19 + TypeScript on TanStack Start (Vite 7)
- Tailwind CSS v4 design system (`src/styles.css`) + shadcn/ui
- Lovable Cloud backend: PostgreSQL, Auth (email/password + Google), row-level security
- Lovable AI Gateway (`google/gemini-3.7-flash`) for assistant, recommendations and quiz generation
- Recharts for analytics, Lucide for icons, Sonner for toasts

## Getting started

```bash
bun install
bun run dev     # http://localhost:8080
bun run build   # production build
```

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are injected automatically by Lovable Cloud. Server-only keys are never exposed to the browser.

## Roles

| Role | Capabilities |
| --- | --- |
| Trainee | Browse catalog, enrol, complete lessons, take timed assessments, earn certificates, use the AI assistant |
| Trainer | Everything above plus create/delete courses, AI quiz generation, learner progress and course analytics |
| Admin | Full access: user management, role assignment, institutional analytics, all course CRUD |

Role is chosen at sign-up (trainee/trainer); admin is granted by an existing admin from the Users page.

## Routes

- `/` landing page, `/auth` sign in / sign up / reset, `/verify` public certificate verification
- `/dashboard`, `/courses`, `/courses/$slug`, `/assessments/$id`, `/my-learning`, `/certificates`, `/assistant`, `/profile`
- `/manage-courses` (trainer/admin), `/users`, `/analytics` (admin)

## Data model

`profiles`, `user_roles`, `courses`, `modules`, `lessons`, `enrollments`, `lesson_progress`, `assessments`, `questions`, `attempts`, `certificates`, `notifications`, `audit_logs` — all with foreign keys, indexes, grants and RLS policies. Roles live in a dedicated `user_roles` table and are checked through the `has_role()` security-definer function to avoid privilege escalation.

Seed data ships six MoES programmes with modules, lessons, assessments and MCQ items.

## Security

Row-level security on every table, JWT sessions, leaked-password (HIBP) checks, Zod validation on all forms and server functions, protected route layout, and audited actions.
