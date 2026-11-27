# Holdfast — Context

Holdfast is the Secure Examination Management System for Technoverse 5.0 / Web-e-Thon (COMSATS University Lahore, 27–28 November 2026).

The problem statement PDF lives next to this file and is gitignored (`docs/**/*.pdf`). This document is the critical reading of that brief: what it actually demands, what is ambiguous, and the decisions we will not relitigate during the build.

## Event constraints

- Development window: 10 hours. Team size: 1–3. Evaluation: 15-minute live demo plus judge-led testing.
- Submission: a git repository with real history, a deployed functional app, and a README with setup, dependencies, test credentials for every role, fictional data, and a description of the innovation challenges.
- No commits, pushes, builds, or deployments after the deadline. Do not rewrite timestamps.
- AI-assisted coding is allowed. No required feature may depend on a paid API, a paid key, a proprietary dataset, specialized hardware, or any external service that requires billing information. Local substitutes are the default.
- Judges award partial marks for incomplete features. Non-functional placeholders do not receive full credit. The same mechanism is not scored twice under two headings.

## What the brief is

A full examination lifecycle for one institution:

1. Staff authenticate and are authorized on the server.
2. Examiners build a question bank and configure an exam.
3. Candidates are enrolled and can enter only inside the window.
4. The attempt survives refresh and disconnect, and the clock is the server's clock.
5. Objective work is marked automatically. Written work is marked by a human.
6. Results are reviewed, then published. A candidate sees only their own published result.
7. Examiners can monitor the sitting and talk to the room.
8. Eight secondary features are expected, not optional extras.
9. At least one open innovation challenge must be a real, demonstrable design.

It is not a quiz widget, a proctoring product, or a multi-campus SaaS.

## Scoreboard

| Area | Marks | What judges can break in the room |
| --- | --- | --- |
| Core functionality (3.1–3.8) | 30 | Role hopping, early entry, refresh, double submit, unpublished results |
| Secondary features (4.1–4.8) | 15 | Offline banner, sandbox leaking into stats, bad CSV, PDF that is not real data |
| Technical quality | 20 | Client-only timer, answer keys in a candidate payload, edits rewriting a live attempt |
| Open innovation | 15 | A slide instead of a working mechanism; claiming the same feature twice |
| UI/UX | 20 | Generic template chrome, timer by color only, no keyboard path, cramped runner |

## Section-by-section reading

### 01 Problem overview

Institutions and organizers need to create, conduct, monitor, and evaluate online exams while facing integrity, fairness, unreliable networks, and scale. The product must implement the core workflow and at least one innovation from section 05.

Reading: "scale" here means the design should not fall over for a room of candidates (indexed queries, presence, autosave). It does not mean a sharding project.

### 02 Roles

- **Administrator** manages users, roles, access, and platform operations.
- **Examiner** creates exams, manages questions and candidates, monitors attempts, evaluates submissions, publishes results.
- **Candidate** sees assigned exams, sits them, and views published results.

There is no invigilator role, no parent role, and no public self-signup in the brief. We will not invent them.

### 03 Core requirements

**3.1 Authentication and authorization.** Three experiences. Admins assign roles. Authorization is enforced on the backend. Examiners and candidates only touch records they are allowed to touch.

**3.2 Examination management.** Title, instructions, schedule, duration, total marks, settings. Lifecycle: draft, published, ongoing, completed. Candidates cannot enter early. Examiners review before publication.

**3.3 Question management.** Reusable bank with category/topic and difficulty. Create, edit, assign. Types: single-answer MCQ, multiple-select, written. Marking schemes must fit the type. Objective questions or choices may be randomized. An active attempt keeps the assignment and the marking scheme it started with.

**3.4 Candidate management.** Examiners enroll and can see enrollment. Candidates see available, upcoming, and completed exams, with instructions and access status. Entry requires eligibility and the availability window.

**3.5 Examination interface.** Questions, marks, remaining time, navigation. Answered / unanswered / marked-for-review. Autosave. Refresh or return restores answers and remaining time. Submit is available. The time limit is enforced. Expiry finalizes using answers accepted inside the window.

**3.6 Monitoring.** Examiners see active attempts, progress, and incidents. They can post announcements during the sitting. Incidents are not conclusive evidence of misconduct. The UI must say so.

**3.7 Evaluation.** Objective items follow the configured scheme, including multiple-select rules. Written items are graded by hand and cannot exceed the assigned marks. Totals stay consistent. Examiners review before publication.

**3.8 Results and analytics.** Publication is controlled. Candidates see only their own published results unless a role is authorized otherwise. Exam-level summaries and candidate scores come from real submissions. Finished attempts are retained.

### 04 Secondary features

All eight are expected. Marks depend on working behavior, usefulness, and integration.

- **4.1** Detect connectivity problems and show save/sync status.
- **4.2** Downloadable PDF reports from real data, with access control.
- **4.3** Examiner sandbox that does not touch real submissions, results, or statistics.
- **4.4** Import candidates and questions from CSV or JSON. Validate and report errors clearly.
- **4.5** Per-question insight: skips, common misses, observed difficulty.
- **4.6** A way to verify an issued report (id or QR) without leaking extra personal data.
- **4.7** Workspace preferences (layout or viewing) that persist.
- **4.8** A scratchpad for rough work inside the sitting. It is not a graded answer.

### 05 Innovation

At least one of 5.1–5.5. Quality over quantity. Must be functional, relevant, and demonstrable. Design decisions and trade-offs must be explainable.

We commit to two, and we keep their scoring stories separate:

- **5.3 Failure-resilient examinations** is the primary challenge. The clock is an absolute server deadline. Disconnect does not pause it and does not grant time. Answers queue locally and replay on reconnect. The server still rejects anything after the deadline. MongoDB remains the record if Redis is empty.
- **5.2 Fairness of randomized examinations** is the second challenge. Papers are a stratified draw by category and difficulty against a target difficulty budget, so candidates do not receive an all-easy or all-hard set. Order and selection still vary.

We do **not** take 5.1 as a judged challenge. Tab and focus events are monitoring signals for 3.6 only. Webcam, lockdown browsers, and keystroke biometrics need special hardware, harm privacy, and the brief already says incidents are not proof of misconduct.

We do **not** build a 5.4 dispute case system. It is a large workflow and would land half-finished. We do **not** invent a 5.5.

### 06 Technical requirements

- Server-side authorization. Protect credentials, answer keys, personal data, and exam records. Public endpoints and public reports stay minimal.
- Timing does not trust the device clock. No duplicate submissions. No inconsistent grading. Snapshots freeze questions and marks for an active attempt.
- Validate on the client and the server. Invalid input, interrupted requests, refreshes, and repeated actions fail clearly.
- Database design and separation of responsibilities must be explainable.
- Technology choice itself earns no marks. Effectiveness does.

### 07 Submission

Git history, deployed app, README, three role credentials, innovation write-up, fictional data, 15-minute demo. Follow the official guide for the exact deadline.

### 08 Evaluation and design

Functionality over quantity. Consistent scenarios across teams. Innovation judged on merit.

UI expectations: consistent and accessible, clear navigation, hierarchy, responsive layout, intuitive workflow. Avoid a generic or unrefined AI-looking interface. Visuals must earn their place. AI use does not change the design score.

## Decisions

These close gaps the brief leaves open.

1. **Single tenant.** One institution. No organization switcher.
2. **Ownership.** An examiner sees only exams they created. An admin sees users and can open exams for operations. A candidate sees only their enrollments, attempts, and published results.
3. **Lifecycle is computed from the schedule.** Stored publication state is `draft` or `published`. Display state is `draft`, `published` (before the window), `ongoing` (inside the window), or `completed` (after the window). Candidates never see drafts.
4. **Deadline.** On start, `deadlineAt = min(startedAt + duration, windowEnd)`. A late start does not extend past the window. Refresh does not move `deadlineAt`. Disconnect does not pause it. Sandbox attempts ignore the window and use `startedAt + duration`, and they are excluded from scores, analytics, and PDFs.
5. **Late answers.** A save is accepted only when `serverNow <= deadlineAt`. Expiry finalizes from the last accepted answers. Submit is idempotent.
6. **Multiple-select marking.** Partial credit, floored at zero: `(correctSelected - wrongSelected) / correctCount * marks`. Single-answer is all-or-nothing. Written scores are human, in `0..questionMarks`. No other negative marking.
7. **Randomization.** Optional per exam. Choice order and question order are shuffled into a snapshot. Choice ids are stable, so the key still matches. The key is never sent to a candidate.
8. **Fair papers (5.2).** Pinned questions (used for the written item every candidate must see) are fixed. The remaining slots are drawn toward a difficulty budget. See ARCHITECTURE.md.
9. **Structural lock.** After publish, the question set, duration, and randomization/fairness settings are locked. Instructions may change. `windowEnd` may be extended. Bank edits do not rewrite snapshots.
10. **Results.** An exam has an explicit `resultsPublished` flag. Candidates see a result only when that flag is on and the attempt is finalized. The public verify page shows exam title, score, issue time, and valid/revoked. It does not show email, answers, or a rank list.
11. **Incidents.** `disconnect`, `reconnect`, `blur`, `focus`, `autosave_failed`. Every incident is stored with `conclusive: false`.
12. **Accounts.** No open registration. Admins create users. CSV import creates candidates with the documented demo password and returns that fact in the import report. Partial import: valid rows commit, invalid rows are listed.
13. **Import policy.** Partial commit with a row-level error report (more demoable than reject-all).
14. **Stack.** MongoDB is the source of truth. Redis is the hot path (deadline cache, answer hash, presence, submit lock, socket fan-out). Express + React + TanStack Query + TanStack Router. Socket.IO for presence and announcements. REST remains the write path for answers. PDFs via `pdfkit`. Passwords via bcrypt. Session via httpOnly JWT cookie. The Vite dev server proxies `/api` and `/socket.io` so the cookie stays same-site without `Secure`.
15. **Product name.** Holdfast. The interface should feel like an invigilation desk: warm paper, ink, and a serif/sans pair. Not a purple SaaS template.
16. **What we cut first if time collapses.** 5.2 before 3.1–3.8, 4.1, 4.6, or the server timer.

## What we will not build

- Multi-institution tenancy, public signup, password-reset email, webcam proctoring, a lockdown browser, plagiarism detection, paid AI grading, payments, native mobile apps, a dispute tribunal, negative marking beyond the multiple-select floor.
