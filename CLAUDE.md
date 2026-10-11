# CLAUDE.md — Clinic Database

## Who you're working with
The product owner is a plastic surgeon. He understands databases, layers and logic
(coded in BASIC years ago) but does not write code now. You write all the code.
Explain decisions in plain language, briefly. Give exact copy-paste commands when he
must run something. Show him how to test each feature in the browser.

## Source of truth
`SPEC.md` in this folder. Read it before starting any work. Build in the phase order
of SPEC §12; do not start a phase until the previous one works and he has tested it.
If a request conflicts with SPEC, say so and ask whether to update SPEC.
`DESIGN.md` + mockups in `design/` = how every screen looks (approved by him). Build
UI to match them; follow its "Screen → phase" table. Use its colour/font tokens only —
no other UI kit look.

## Stack
- Next.js (App Router, TypeScript), PostgreSQL, Prisma, Tailwind
- Docker + docker compose for everything (dev on Linux laptop, prod on Synology DS224+)
- Keep dependencies few and well known.
- UI: Tailwind with the tokens in DESIGN.md; small own components (no heavy UI kit).

## Non-negotiable rules
- Health data is GDPR special-category data. Never send clinical data to GHL or any
  third party except what SPEC §10 allows.
- Every table with patient data has `companyId`; every query filters by it.
- Audit log for every read of a patient record and every create/update/delete.
- Never use real patient data in development. Use a seed script with fake patients.
- Secrets in `.env` only (never committed). Provide `.env.example`.
- Index every searchable column; patient search must feel instant.
- UI in Greek first; all strings in translation files so English can be added.
- Signed documents are immutable: store hash, timestamp, template version.

## Workflow
- Small steps. After each feature: run it, run tests, tell him what to click to check it.
- Use git; commit after each working step with a clear message.
- Keep a `CHANGELOG.md` in plain language for him.
