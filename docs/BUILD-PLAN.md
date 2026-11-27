# Holdfast — Build plan

Order is vertical. Do not start the secondary list until a candidate can be enrolled, sit, submit, and be scored. If the clock collapses, drop 5.2 before dropping 3.1–3.8, the server deadline, 4.1, or 4.6.

## Phases

1. **Docs.** CONTEXT, PRD, ARCHITECTURE, this file. Gitignore ignores the PDF only.
2. **Foundation.** Mongo, Redis, models, cookie auth, role middleware, seed users, routed shells for admin, examiner, and candidate.
3. **Bank and exams.** Question CRUD, draft exam, assignment, publish, enrollment, candidate home with blocking reasons.
4. **Attempt engine.** Snapshots, `deadlineAt`, autosave, outbox, idempotent submit, expiry sweep.
5. **Grading and results.** Objective marking, written marks, review, publish, own-result view.
6. **Monitoring.** Presence, incidents labeled non-conclusive, announcements over Socket.IO.
7. **Secondary set.** Network banner, sandbox, CSV/JSON import, question analytics, PDF and verify code, workspace preferences, scratchpad.
8. **Fair papers.** Difficulty-budget generator and the two-paper preview.
9. **Product UI.** Paper/ink visual system, focus, timer text, responsive palette, runner that does not look like a dashboard.
10. **Demo readiness.** Fictional seed exam, README credentials, smoke list below.

Deploy is part of phase 10 because the brief requires a deployed URL. Feature code must not call a service that asks for a credit card. Compose file is the local dependency story.

## Demo script (15 minutes)

1. Log in as Omar. Show the bank and the published midterm. Open fair-paper preview and point at two different sets with close weight totals (5.2).
2. Log in as Hana. Show upcoming versus available. Enter the runner. Answer, mark for review, open the scratchpad, change font scale.
3. Turn the network off. Answer another question. Refresh. Turn the network on. Show the outbox flush and the unchanged deadline (4.1 and 5.3).
4. Submit, or let a short drill exam expire if one was created.
5. As Omar, show the live roster and send an announcement before submit if the sitting is still open. Then grade the written answer, reject an over-max mark, publish.
6. As Hana, show only her result. Download the PDF. Open `/verify/:code` in a clean context and show the missing email.
7. As Omar, import a CSV with one bad row and show the error report. Start a sandbox and show that it is absent from analytics.
8. As Amina, change a role or create a user. As Hana, hit a grading URL and show the 403 if a judge asks.

## Judge smoke, mapped to the README

- Candidate token on `POST /api/questions` → 403.
- Candidate fetches another candidate's result → 404 or 403, no body leak.
- Start an exam before `windowStart` → blocked with a reason.
- Refresh mid-attempt → same `deadlineAt`, same answers.
- Submit twice → one score.
- Save after `deadlineAt` → rejected, previous answer kept.
- Edit a bank question after an attempt exists → snapshot stem unchanged.
- Sandbox attempt → missing from analytics and from Hana's list.
- Unpublished exam → Hana has no result page.
- Verify page → no email, no script.
- Written mark above the question max → 400.
- Deactivated user → login fails.

## Seed identities

Created by `npm run seed` in `backend/`. Passwords are demo-only and are repeated in the README.

- Amina, admin — `admin@holdfast.test`
- Omar, examiner — `examiner@holdfast.test`
- Hana, candidate — `hana@holdfast.test`
- Bilal, candidate — `bilal@holdfast.test`

Shared demo password pattern is documented in the README next to each account. Bilal's attempt is already finalized and the exam results are published so analytics, the PDF, and verify work before Hana sits. Hana is enrolled and has not started, so the live demo does not collide with Bilal's script.

## Done when

- `npm test` in `backend/` passes the pure tests: marking, deadline clamp, fair-paper budget, candidate serializer strips keys.
- `npm run typecheck` passes in `backend/` and `npm run build` passes in `frontend/`.
- The smoke list above has been walked once against a seeded database.
