# Holdfast

Secure examination desk for Technoverse 5.0 / Web-e-Thon. One institution, three roles, a server-owned clock, and papers drawn to a difficulty budget.

The product reading of the brief is in [docs/CONTEXT.md](docs/CONTEXT.md), [docs/PRD.md](docs/PRD.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md).

## Stack

MongoDB is the record. Redis caches deadlines, answer hashes, and presence. Express serves the API. React, TanStack Router, and TanStack Query serve the desk. Socket.IO carries announcements. PDFs are generated locally with PDFKit. Nothing in the feature set calls a paid API.

## Run locally

```bash
docker compose up -d
cd backend && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. The Vite server proxies `/api` and `/socket.io` to port 3000 so the session cookie stays on the same origin.

## Test credentials

| Person | Role | Email | Password |
| --- | --- | --- | --- |
| Amina Shah | Administrator | admin@holdfast.test | Admin123! |
| Omar Rahman | Examiner | examiner@holdfast.test | Examiner123! |
| Hana Iqbal | Candidate | hana@holdfast.test | Candidate123! |
| Bilal Khan | Candidate | bilal@holdfast.test | Candidate123! |

`npm run seed` in `backend/` rebuilds this fictional sitting. Hana has not started. Bilal has a finalized, published attempt so analytics, the PDF, and public verification already have real data. The seed log prints Bilal's verification code.

Imported candidates receive `Candidate123!`. The import response says so.

## Innovation

**5.3 Failure-resilient examinations.** `deadlineAt` is an absolute server timestamp. Disconnect and refresh do not pause it. Answers that fail to reach the server sit in a local outbox and replay later. The server still rejects anything after the deadline. MongoDB stores every accepted answer, so Redis is a cache rather than the only copy.

**5.2 Fair randomized papers.** Pinned questions (the written item) are on every paper. The remaining slots are drawn toward a difficulty budget so two candidates do not receive an all-easy paper and an all-hard paper. Omar can preview two papers on the fairness tab.

We do not use webcam or lockdown-browser proctoring. Tab and focus changes are logged as non-conclusive signals for monitoring only.

## Judge smoke

- Sign in as Hana and open a grading or question URL. The API returns 403, not an empty screen pretending the action worked.
- Hana cannot open Bilal's result.
- Refresh during Hana's attempt. The deadline and the accepted answers are unchanged.
- Submit twice. The score does not double.
- Turn the network off, answer, refresh, turn it back on. Queued answers sync only if the deadline has not passed.
- Edit a bank question after Bilal's attempt exists. His snapshot text does not change.
- Start a sandbox from Omar's desk. It does not appear in analytics.
- Download Bilal's PDF and open `/verify/<code>`. The public page has the score and no email.
- Enter a written mark above the question maximum. The API rejects it.
- Deactivate a user as Amina. That person can no longer sign in.

## Checks

```bash
cd backend && npm test && npm run typecheck
cd frontend && npm run build
```
