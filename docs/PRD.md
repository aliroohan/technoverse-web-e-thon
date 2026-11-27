# Holdfast — Product requirements

Source of truth for behavior. Context and rejected alternatives live in [CONTEXT.md](CONTEXT.md). Data model and modules live in [ARCHITECTURE.md](ARCHITECTURE.md).

Personas: **Amina** (administrator), **Omar** (examiner), **Hana** (candidate). A second candidate, **Bilal**, exists so results and fairness can be shown without using Hana's live attempt.

## Global rules

- Every mutating route and every sensitive read checks the session on the server.
- Candidate payloads never include `correctChoiceIds`, written-answer rubrics, or another person's score.
- Validation errors name the field. Save status is one of: idle, saving, saved, failed, rejected-late.
- Empty, loading, and error states are visible. Buttons say what they do.
- Sandbox attempts never appear in analytics, PDFs, cohort results, or publish checks.

## 3.1 Authentication and authorization

Amina can create a user, set the role to admin, examiner, or candidate, and deactivate an account. Deactivated users cannot log in.

Omar logs into an examiner home. Hana logs into a candidate home. Amina logs into user management.

Acceptance:

- Wrong password returns a generic failure and does not reveal whether the email exists.
- Logout clears the cookie.
- Hana's session receives 403 on user admin, question mutations, grading, monitoring of Omar's exam, and Bilal's result.
- Omar receives 403 on another examiner's exam and on user-role changes.
- Hiding a link is not the control. The API is the control.

## 3.2 Examination management

Omar creates an exam with title, instructions, window start, window end, duration minutes, total marks, and settings (randomize questions, randomize choices, fair paper on/off, question count, difficulty budget).

Acceptance:

- Draft exams are editable, including the question set.
- A draft is invisible to Hana.
- Publish requires at least one question, a window with `end > start`, and a positive duration.
- After publish, question membership, duration, and fairness/randomize settings cannot change. Instructions can. `windowEnd` can move later, not earlier than now.
- Display state:
  - `draft` while unpublished
  - `published` when published and the server clock is before `windowStart`
  - `ongoing` when published and the server clock is inside the window
  - `completed` when published and the server clock is after `windowEnd`
- Hana cannot start before `windowStart` or after `windowEnd`.

## 3.3 Question management

The bank is reusable. Each question has a stem, a type (`single`, `multi`, `written`), category, difficulty (`easy`, `medium`, `hard`), and marks.

- `single`: two or more choices, exactly one correct choice.
- `multi`: two or more choices, one or more correct choices.
- `written`: no choices and no key.

Acceptance:

- Omar can create, edit, and assign or unassign questions on a draft exam.
- Editing a bank question does not change a snapshot already stored on an attempt.
- Where the exam enables it, question order and choice order are shuffled per attempt and then frozen.
- Marks on the attempt come from the assignment snapshot, not from a later bank edit.

## 3.4 Candidate management

Omar enrolls an existing candidate and can remove that enrollment only when the candidate has no non-sandbox attempt.

Hana's home has three groups: available, upcoming, completed. Each card shows the title, window, duration, instructions, and a plain reason if entry is blocked (too early, already submitted, window closed).

Acceptance:

- A candidate who is not enrolled does not see the exam.
- Starting is rejected when enrollment is missing, the window is closed, or a non-sandbox attempt is already finalized.
- Returning while `in_progress` resumes the same attempt and the same deadline.

## 3.5 Examination interface

The runner is a separate full-screen layout.

It shows the stem, the marks, a text timer derived from `deadlineAt`, and a question palette. Palette states: answered, unanswered, marked for review. A question can be answered and marked for review at the same time.

Acceptance:

- Changing an answer autosaves.
- Refresh restores answers, flags, scratchpad text, and the original `deadlineAt`.
- The timer is computed as `deadlineAt - (Date.now() + serverOffset)`. Heartbeats correct the offset. The device clock is never the authority.
- Submit asks for confirmation, then finalizes once.
- A second submit returns the same finalized attempt.
- When the server clock passes `deadlineAt`, the attempt finalizes from the last accepted answers. Further saves return a late rejection.

## 3.6 Monitoring

Omar opens a live view for an ongoing exam: each active attempt, questions answered out of total, last save time, and connection presence.

He can post an announcement. Hana sees it in the runner without reloading.

Incidents recorded: disconnect, reconnect, blur, focus, autosave failure. The screen states that these are signals for review, not a finding of misconduct.

## 3.7 Evaluation and grading

On finalize, objective questions are scored immediately.

- Single: full marks on an exact match of the correct choice, otherwise zero.
- Multi: `(correctSelected - wrongSelected) / correctCount * marks`, never below zero.
- Written: unscored until Omar enters a mark.

Acceptance:

- A written mark outside `0..snapshotMarks` is rejected.
- The total is objective plus written, stable across refresh.
- If any written question is ungraded, the attempt stays `pending_subjective` and the exam cannot be published.
- When every finalized non-sandbox attempt is `ready`, Omar can review scores and then publish.

## 3.8 Results and analytics

After publish, Hana sees her score, per-question outcome for objective items, and the awarded mark for written items. She does not see the cohort.

Omar sees, from real non-sandbox finalized attempts: count submitted, mean score, completion among enrollments, and a simple score distribution. He also sees each candidate's score.

Finished attempts remain readable after the window closes.

## 4.1 Network-aware interface

The runner shows online, offline, saving, saved, failed, and rejected-late.

If a save fails because the browser is offline, the answer stays in a local outbox and the palette still shows the candidate's current choice. When the network returns, the outbox replays in order. The server applies the deadline check again. A replay after `deadlineAt` is shown as rejected-late and is not stored as a new accepted answer.

This is the required status UI. The fairness rule that the clock does not pause is innovation 5.3, specified separately below.

## 4.2 PDF report

Omar or the owning candidate (after publish) can download a PDF built from the stored attempt: exam title, candidate name, score, per-question marks, and a verification code. Hana cannot download Bilal's PDF. Unpublished attempts do not produce a candidate-facing PDF. Omar can download before publish so he can review the document he is about to issue.

## 4.3 Sandbox

Omar can start a sandbox attempt from the exam, including while it is still a draft. The runner is the real runner with a visible "Sandbox" banner. The attempt is flagged `isSandbox`. It is omitted from analytics, publish gates, cohort lists, and PDFs. Hana cannot open Omar's sandbox.

## 4.4 Bulk import

Omar can upload a CSV or JSON file of questions, and a CSV or JSON file of candidates.

Question CSV headers: `stem,type,category,difficulty,marks,choices,correct`. `choices` uses `|` between options. `correct` uses `|` between choice letters (`A|C`) or is empty for written.

Candidate CSV headers: `name,email`. Optional `examId` on the request enrolls valid new or existing candidates.

Acceptance:

- Valid rows are created. Invalid rows are returned with a row number and a reason.
- A duplicate email does not create a second user; the row is reported and, if an exam id was supplied, the existing candidate is enrolled.
- Imported candidates receive the documented demo password. The response tells Omar that, so he is not guessing.

## 4.5 Question analytics

For each question that appeared on at least one real finalized attempt, Omar sees how many sat it, how many skipped it, how many objective answers were incorrect, and empirical difficulty (`incorrect / non-skipped`). A written question reports skips and average awarded marks instead of incorrect rate. If nobody has submitted, the page says so.

## 4.6 Verifiable reports

Publishing (or the first PDF issue, whichever comes first) creates a short verification code stored only as a hash. The PDF and the result page show the code. `/verify/:code` is public and shows exam title, score, issued time, and valid or revoked. It does not show the email address, the answer script, or other candidates.

## 4.7 Workspace preferences

Hana can set font scale, contrast (default or high), and palette position (side or bottom). The choice is saved on her user and reapplied in the runner after refresh and on the next exam. The control sits inside the runner so it is part of the sitting, not a buried settings page only.

## 4.8 Scratchpad

A drawer in the runner holds rough-work text. It autosaves, survives refresh, and is never copied into the graded response. Omar does not see it in the marking view. It is a candidate aid, not evidence.

## 5.3 Failure-resilient examinations

Problem: a dropped network or a refresh can either lose work or tempt the product to "pause" the clock, which hands the candidate extra time.

Mechanism:

- `deadlineAt` is absolute and stored on the attempt.
- Presence and connectivity are informational.
- The outbox replays saves without moving the deadline.
- The server rejects late writes.
- MongoDB holds every accepted answer. Redis can be flushed and the attempt still resumes.

Demo: Hana answers question 1, goes offline, answers question 2, refreshes, reconnects. Question 1 is still stored. Question 2 syncs if the deadline has not passed. The timer matches the original deadline. A save after the deadline is rejected and the attempt is finalized.

Trade-off: we do not pause for genuine power loss. Pausing is fairer to the unlucky and easier to abuse. The brief asks us not to grant extra time. Examiners can extend `windowEnd` for the whole cohort if the room loses power; that is an explicit, audited schedule change rather than a silent per-candidate pause.

## 5.2 Fair randomized papers

Problem: a pure shuffle of a large bank, or a random subset, can give one candidate three hard questions and another three easy ones.

Mechanism, used only when the exam setting is on:

- Pinned assignment rows are on every paper (the written question).
- Remaining slots are filled to `questionCount` from the unpinned pool.
- Each draw is scored by absolute distance between the sum of difficulty weights (easy 1, medium 2, hard 3) and `difficultyBudget`.
- The generator prefers draws that also spread across categories.
- It keeps the closest draw inside tolerance when one exists.
- Two candidates can receive different question sets with similar weight totals. Choice order can still be shuffled.

Demo: Omar generates two preview papers and shows the weight totals side by side, then starts two real or sandbox attempts and shows they are not identical.

Trade-off: perfect equality is impossible with a small pool. We optimize for a budget and show the actual weight on the preview so the examiner can see the compromise. We do not claim two papers are psychometrically equated.

## 06–08 Product obligations

- README lists setup, Docker services, seed command, and the three passwords.
- Seed data is fictional and is enough to demo a live sitting, a finished result, analytics, a PDF, and two fair papers.
- The interface uses a deliberate type pairing and a paper/ink palette, visible focus, labeled controls, a timer that is not color-only, and a runner that works on a laptop width and a narrow width (palette moves bottom).
- Judge smoke scenarios are listed in the README.

## Out of scope

Listed in CONTEXT.md under "What we will not build."
