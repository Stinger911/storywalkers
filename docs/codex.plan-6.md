# EPIC-UX Development Plan

## Source

- Epic: `EPIC-UX`
- Title: `EPIC: UX Polish (progress, locked states, naming, loaders)`
- Source file: [`gh-items.nogit.json`](/Users/stinger/Work/Lab18/StoryWalkers/gh-items.nogit.json)
- Child tasks:
  - `FE-RENAME-TERMS`
  - `FE-PROGRESS-BAR`
  - `FE-LOCKED-STATE`
  - `FE-SKELETONS`

## Goal

Polish the student and admin UX without changing the business flow for `v0.9`:

- rename visible UI terminology for clarity
- make progress more legible and consistent
- introduce lesson locked/unlocked visuals
- replace generic loading text with skeletons
- standardize empty states

This epic is frontend-heavy. Backend work is mostly contract stabilization and regression protection, not new product behavior.

## Current-State Notes

### Frontend

- Student dashboard already has a progress bar and a custom loading skeleton in [`frontend/src/routes/student/StudentHome.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentHome.tsx), but the pattern is local and inconsistent with other screens.
- Student library, question views, and many admin screens still use plain `Loading…` text and weak empty states.
- The reusable `Skeleton` primitive already exists in [`frontend/src/components/ui/skeleton.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/components/ui/skeleton.tsx), but adoption is incomplete.
- Student/admin wording is mixed: user-facing UI still exposes `Step` terminology in several places even though the intended UX direction is `Lesson`.

### Backend

- Student-facing progress can already be computed from plan steps in the frontend via [`frontend/src/routes/student/studentPlanContext.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/studentPlanContext.tsx).
- Admin student list already exposes cached progress fields (`progressPercent`, `stepsDone`, `stepsTotal`) from [`backend/app/routers/admin_students.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/routers/admin_students.py).
- No new backend endpoint is strictly required for this epic if the frontend keeps the “all unlocked for v0.9” rule and computes lesson progress client-side as planned in the tracker item.

## Delivery Strategy

Implement this epic in four frontend slices, with backend support running in parallel as a contract-safety track.

Recommended order:

1. Naming pass
2. Shared loading and empty-state primitives
3. Progress UI consolidation
4. Locked/unlocked lesson visuals

Reason:

- Naming changes affect screenshots, labels, and acceptance criteria across all later slices.
- Skeleton/empty-state primitives should be standardized before broad UI rollout.
- Progress components should be introduced once copy and layout conventions are stable.
- Locked-state visuals should land last because they sit on top of the final lesson card design.

## Frontend Plan

### 1. FE-RENAME-TERMS

#### Objective

Make visible UX terminology consistent:

- `Step` -> `Lesson`
- `Edit` -> `Manage`

Keep route names, API field names, and backend payloads unchanged unless a technical rename is already required elsewhere.

#### Primary files to audit

- [`frontend/src/routes/student/StudentHome.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentHome.tsx)
- [`frontend/src/routes/admin/AdminStudentProfile.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStudentProfile.tsx)
- [`frontend/src/routes/admin/AdminStepCompletions.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStepCompletions.tsx)
- [`frontend/src/routes/admin/AdminCourseLessons.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminCourseLessons.tsx)
- [`frontend/src/lib/i18n.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/lib/i18n.tsx)

#### Frontend tasks

- Audit all user-facing labels, buttons, tab titles, badges, and empty states for old terms.
- Update i18n dictionaries first, then remove hardcoded English strings where practical in touched files.
- Keep internal identifiers stable:
  - do not rename API payload keys like `stepsDone`
  - do not rename backend route paths
  - do not rename Firestore collection/document structure for this epic

#### Acceptance

- No visible `Step` wording remains on student-facing lesson/progress screens unless the word is intentionally technical/admin-only.
- No visible `Edit` wording remains where the intended action is really management/configuration.
- EN/RU copy stays aligned.

### 2. FE-SKELETONS

#### Objective

Replace generic loading text with consistent skeleton loaders and upgrade empty states.

#### Priority screens

- Student:
  - [`frontend/src/routes/student/StudentLibrary.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentLibrary.tsx)
  - [`frontend/src/routes/student/StudentQuestionDetail.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentQuestionDetail.tsx)
  - [`frontend/src/routes/student/StudentQuestions.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentQuestions.tsx)
  - [`frontend/src/routes/student/StudentLibraryDetail.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentLibraryDetail.tsx)
- Admin:
  - [`frontend/src/routes/admin/AdminStudents.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStudents.tsx)
  - [`frontend/src/routes/admin/AdminQuestions.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminQuestions.tsx)
  - [`frontend/src/routes/admin/AdminLibrary.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminLibrary.tsx)
  - [`frontend/src/routes/admin/AdminGoals.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminGoals.tsx)
  - [`frontend/src/routes/admin/AdminCourses.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminCourses.tsx)

#### Frontend tasks

- Create 2-3 reusable skeleton patterns instead of ad hoc placeholder blocks:
  - list row/card skeleton
  - detail page/form skeleton
  - stats/rail skeleton
- Standardize empty states:
  - no results
  - no data configured yet
  - no lessons/questions/library entries yet
- For empty states, always include one clear next action when possible.

#### Acceptance

- No major student/admin list page falls back to plain `Loading…` text.
- Empty states are specific to the screen context and include a next step where useful.

### 3. FE-PROGRESS-BAR

#### Objective

Make lesson/course progress consistently visible across the student experience.

#### Primary files

- [`frontend/src/routes/student/StudentHome.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentHome.tsx)
- [`frontend/src/routes/student/studentPlanContext.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/studentPlanContext.tsx)
- Optional reuse in admin/student summary surfaces:
  - [`frontend/src/routes/admin/AdminStudents.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStudents.tsx)

#### Frontend tasks

- Extract a reusable progress presentation unit:
  - percentage
  - done/total counter
  - bar fill
- Keep student progress computed client-side from plan steps for this epic.
- Ensure the current lesson focus area and the lesson list visually agree on progress state.
- If admin list cards already show counters, align styling with the new shared progress language rather than inventing a second pattern.

#### Acceptance

- Student dashboard always shows:
  - percent complete
  - done/total lessons
  - a clear bar or equivalent visual indicator
- Progress visuals remain stable for zero-state, partial, and complete plans.

### 4. FE-LOCKED-STATE

#### Objective

Introduce lesson cards/components that can render locked and unlocked states even if `v0.9` keeps all lessons unlocked by default.

#### Primary files

- [`frontend/src/routes/student/StudentHome.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/StudentHome.tsx)
- any extracted lesson card component created during implementation

#### Frontend tasks

- Add a presentational lesson state model:
  - `completed`
  - `current`
  - `available`
  - `locked`
- For `v0.9`, keep gating logic simple:
  - default all lessons to unlocked unless the team explicitly decides otherwise
- Design the card/button treatment now so later backend gating can plug into it without redesign.
- Locked state should clearly disable the primary action and explain why the lesson is unavailable.

#### Acceptance

- The UI can render locked lesson visuals without backend changes.
- Unlocked behavior remains unchanged.
- The component contract is ready for future backend-driven locking.

## Backend Plan

### Scope

Backend is a support track for this epic, not the main delivery stream.

### Required backend tasks

#### 1. Contract review and freeze

Verify that the following existing responses are sufficient for the frontend implementation:

- student plan/steps responses used by [`studentPlanContext.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/student/studentPlanContext.tsx)
- admin student list response from [`backend/app/routers/admin_students.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/routers/admin_students.py)

Output:

- short backend note in the PR or issue thread confirming:
  - no new endpoint is required for `EPIC-UX`
  - existing fields are the source of truth for progress

#### 2. Regression protection

Add or update backend tests only if frontend implementation reveals unstable contracts around:

- step ordering
- `isDone`
- `stepsDone`
- `stepsTotal`
- `progressPercent`

#### 3. Optional support changes only if frontend is blocked

Only introduce backend changes if a concrete frontend blocker appears. Valid examples:

- expose a backend-calculated progress summary on a route that currently lacks enough data
- add an optional `isLocked`/`uiState` field to step payloads for future-readiness
- update OpenAPI if any payload shape is intentionally extended

Non-goal:

- no route churn
- no Firestore schema rewrite
- no rename of established API fields purely for UX wording reasons

## Backend/Frontend Handoff Contract

Frontend should assume:

- visible wording can diverge from internal API naming
- lesson progress is computed from existing step data unless backend explicitly adds summary fields
- locked-state visuals are UI-only for this epic

Backend should guarantee:

- current progress-related fields remain stable
- no surprise payload rename during the epic
- any optional new fields are additive and non-breaking

## QA and Verification Plan

### Frontend

- Update or add targeted tests for renamed labels where stable.
- Add UI tests for:
  - student dashboard progress rendering
  - locked/unlocked lesson state rendering
  - skeleton visibility while loading
  - empty state rendering for no-data screens

Likely files:

- [`frontend/tests/student/StudentHome.test.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/tests/student/StudentHome.test.tsx)
- [`frontend/tests/admin/AdminStudents.test.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/tests/admin/AdminStudents.test.tsx)
- new tests near student/library/question routes if changed

### Backend

- Keep or add regression tests around existing progress payloads if touched.

Likely files:

- [`backend/tests/test_admin_students.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/tests/test_admin_students.py)
- plan/status related backend tests if API changes become necessary

## Implementation Split by Developer Role

### Frontend developer

- own all four tracker tasks under `EPIC-UX`
- extract reusable skeleton and progress UI primitives
- perform terminology rename pass through i18n and touched screens
- implement locked-state visuals
- update frontend tests

### Backend developer

- validate that current APIs cover the epic scope
- guard payload stability during frontend rollout
- implement only additive contract changes if frontend is blocked
- update backend tests/OpenAPI only when API shape changes

## Recommended Execution Sequence

1. Frontend: terminology audit and rename pass
2. Frontend: shared skeleton/empty-state primitives
3. Frontend: progress component extraction and rollout
4. Frontend: locked-state UI treatment
5. Backend: only additive support work if a real frontend blocker appears
6. QA sweep across student + admin surfaces

## Definition of Done

- EPIC-UX child tasks are implemented or explicitly closed as not-needed with rationale.
- Student lesson/progress UX is visually consistent.
- Admin/student loading and empty states are no longer text-only on the main touched screens.
- User-facing wording is consistent with the new naming direction.
- No breaking backend/API changes are introduced.
- Relevant frontend and backend tests pass.
