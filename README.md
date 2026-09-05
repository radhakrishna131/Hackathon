# Capacity Connect

> AI-powered digital capacity building and learning management portal for the Ministry of Earth Sciences.
> Smart India Hackathon 2026 — Problem Statement SIH26075

---

## Overview

Capacity Connect is a full-stack learning management system built to digitise and scale training programmes across MoES institutions — INCOIS, IMD, IITM, NCPOR, NRSC, and others. It provides structured course delivery, AI-assisted learning, timed assessments, verifiable certificates, and institutional analytics under a unified, role-based platform.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, TanStack Start, Vite 7 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | PostgreSQL via Lovable Cloud, Row-Level Security |
| Auth | Email/password + Google OAuth, JWT sessions, HIBP leaked-password checks |
| AI | Google Gemini 3.7 Flash via AI Gateway — assistant, recommendations, quiz generation |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | Sonner |
| Validation | Zod (all forms and server functions) |

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- A Lovable Cloud project with PostgreSQL and Auth configured
- Environment variables set (see below)

### Install and run

```bash
bun install
bun run dev       # development server → http://localhost:8080
bun run build     # production build
bun run preview   # preview production build locally
```

### Environment variables

Environment variables are injected automatically by Lovable Cloud. For local development, create a `.env.local` file at the project root:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

Server-only secrets (service role key, AI gateway token) are never exposed to the browser. Do not commit `.env.local`.

---

## Roles and capabilities

| Role | Capabilities |
|---|---|
| **Trainee** | Browse course catalog, enrol, complete lessons, take timed assessments, earn certificates, use the AI assistant |
| **Trainer** | Everything above, plus create and delete courses, generate AI quizzes, view learner progress and course analytics |
| **Admin** | Full access: user management, role assignment, institutional analytics, all course CRUD, audit log |

Roles are chosen at sign-up (trainee or trainer). Admin access is granted by an existing admin from the Users page. Role checks are enforced server-side via the `has_role()` security-definer function to prevent privilege escalation.

---

## Routes

### Public

| Route | Description |
|---|---|
| `/` | Landing page |
| `/auth` | Sign in, sign up, password reset |
| `/verify` | Public certificate verification |

### Authenticated

| Route | Access |
|---|---|
| `/dashboard` | All roles |
| `/courses` | All roles |
| `/courses/$slug` | All roles |
| `/assessments/$id` | All roles |
| `/my-learning` | All roles |
| `/certificates` | All roles |
| `/assistant` | All roles |
| `/profile` | All roles |
| `/manage-courses` | Trainer, Admin |
| `/users` | Admin |
| `/analytics` | Admin |

---

## Data model

The schema covers the full learning lifecycle with foreign keys, indexes, grants, and RLS policies on every table.

```
profiles            — extended user data linked to auth.users
user_roles          — role assignments (trainee / trainer / admin)
courses             — course metadata, slug, author, visibility
modules             — ordered modules within a course
lessons             — individual lesson units with content and duration
enrollments         — learner–course relationships and completion state
lesson_progress     — per-lesson completion tracking per learner
assessments         — timed assessments linked to a course
questions           — MCQ items belonging to an assessment
attempts            — assessment attempt records with score and timestamps
certificates        — issued certificates with verifiable credential IDs
notifications       — in-app notification queue per user
audit_logs          — admin-facing record of sensitive actions
```

Seed data ships six MoES programmes with modules, lessons, assessments, and MCQ items covering Climate Science, Oceanography, Seismology, Polar Science, Atmospheric Sciences, and Remote Sensing.

---

## Security

- Row-level security on every table — users can only read and write their own data unless their role permits otherwise
- `has_role()` is a security-definer function; role checks never run as the calling user
- JWT sessions with short expiry and refresh rotation
- Leaked-password checks via the HaveIBeenPwned API at sign-up and password change
- Zod validation on all form inputs and server functions
- Protected route layout redirects unauthenticated users before rendering
- Sensitive actions (role assignment, certificate issuance, user deletion) are written to `audit_logs`
- Server-only keys are never bundled into the client

---

## Project structure

```
src/
├── components/         # Shared UI components
│   ├── ui/             # shadcn/ui primitives
│   └── ...             # App-specific components
├── routes/             # TanStack Start file-based routes
│   ├── index.tsx       # Landing page
│   ├── auth.tsx
│   ├── dashboard.tsx
│   ├── courses/
│   ├── assessments/
│   ├── manage-courses.tsx
│   ├── users.tsx
│   └── analytics.tsx
├── lib/                # Supabase client, auth helpers, utilities
├── hooks/              # Custom React hooks
├── styles.css          # Tailwind v4 design system tokens
└── main.tsx
supabase/
├── migrations/         # All schema migrations in order
└── seed.sql            # Six MoES seed programmes
```

---

## AI features

### Learning assistant
Powered by Gemini 3.7 Flash via the AI Gateway. Context-aware responses grounded in enrolled course material. Accessible from `/assistant`.

### Quiz generation
Trainers can generate MCQ assessments from course content with configurable question count and difficulty. Generated quizzes are previewed before saving. Available from the Manage Courses page.

### Recommendations
The dashboard surfaces personalised course recommendations based on enrolment history and completion patterns.

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Run `bun install` and `bun run dev` to confirm the dev server starts cleanly.
3. Write or update tests for any logic you add or change.
4. Open a pull request with a clear description of what changed and why.
5. Do not commit `.env.local`, generated build output, or Supabase service role keys.

---

## Licence

This project was developed for Smart India Hackathon 2026 (Problem SIH26075). All rights reserved by the contributing team. Refer to `LICENCE` for terms.
