# EPIC-ADMIN Development Plan

## Source

- Epic: `EPIC-ADMIN`
- Title: `EPIC: Admin Improvements (filters/sort + safe delete + usability)`
- Source file: [`gh-items.nogit.json`](/Users/stinger/Work/Lab18/StoryWalkers/gh-items.nogit.json)
- Epic tasks:
  - `FE-ADMIN-STUDENTS-FILTERS`
  - `BE-ADMIN-STUDENTS-QUERY`
  - `FE-ADMIN-SAFE-DELETE`
  - `BE-SOFT-DELETE-DECISION`

## Epic Goal

Improve the admin surface so staff can:

- find students faster with useful filters and predictable ordering
- delete or deactivate entities safely
- work with admin CRUD screens that behave consistently

This epic is already partially implemented. The remaining work is mostly finishing the UX and closing gaps between different admin modules.

## Implementation Status Check

### 1. `BE-ADMIN-STUDENTS-QUERY`

#### Already implemented

Backend admin students list already supports:

- `status`
- `role`
- `q`
- `limit`

Primary implementation:

- [`backend/app/routers/admin_students.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/routers/admin_students.py)

Observed behavior:

- `role=staff` is supported by mapping to `admin` and `expert`
- `status` is validated
- `q` is applied in-memory to email/displayName
- deterministic ordering currently uses `createdAt`
- progress metrics are returned:
  - `progressPercent`
  - `stepsDone`
  - `stepsTotal`

Tests already exist:

- [`backend/tests/test_admin_students.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/tests/test_admin_students.py)

#### Not fully implemented

- `cursor` is accepted but ignored
- sort options are not implemented
- stable ordering is only `createdAt`, with no explicit API contract for other sort modes

#### Status

`Partially done`

### 2. `FE-ADMIN-STUDENTS-FILTERS`

#### Already implemented

Frontend student directory already supports:

- search by name/email via `q`
- separate student/staff columns
- display of progress counters

Primary implementation:

- [`frontend/src/routes/admin/AdminStudents.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStudents.tsx)
- [`frontend/src/lib/adminApi.ts`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/lib/adminApi.ts)

#### Missing

- no status filter UI
- no role filter UI exposed beyond the hardcoded split into student/staff requests
- no sort UI
- no persistence of filter state in URL

#### Status

`Partially done`

### 3. `FE-ADMIN-SAFE-DELETE`

#### Already implemented

Safe destructive confirmation already exists in some places:

- student deletion uses typed confirmation `DELETE`
  - [`frontend/src/routes/admin/AdminStudentProfile.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStudentProfile.tsx)
  - tests in [`frontend/tests/admin/AdminStudentProfile.test.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/tests/admin/AdminStudentProfile.test.tsx)
- plan reset uses typed confirmation `RESET_STEPS`
- step completion revoke already uses a dialog-based confirmation
  - [`frontend/src/routes/admin/AdminStepCompletions.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStepCompletions.tsx)

#### Missing

The pattern is not reusable or consistently applied:

- goals still use `window.confirm`
  - [`frontend/src/routes/admin/AdminGoals.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminGoals.tsx)
- courses still use `window.confirm`
  - [`frontend/src/routes/admin/AdminCourses.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminCourses.tsx)
- step templates still use `window.confirm`
  - [`frontend/src/routes/admin/AdminStepTemplates.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStepTemplates.tsx)
- categories and lessons also still use direct confirm dialogs

#### Status

`Partially done`

### 4. `BE-SOFT-DELETE-DECISION`

#### Already implemented

Courses and lessons already use soft delete via `isActive`:

- router:
  - [`backend/app/routers/admin_courses.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/routers/admin_courses.py)
- repository:
  - [`backend/app/repositories/courses.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/repositories/courses.py)

Student-facing onboarding already hides inactive courses:

- [`backend/app/routers/courses.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/routers/courses.py)
- [`frontend/src/routes/onboarding/OnboardingCourses.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/onboarding/OnboardingCourses.tsx)

Relevant tests already exist:

- [`backend/tests/test_admin_courses.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/tests/test_admin_courses.py)
- [`backend/tests/test_courses_api.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/tests/test_courses_api.py)
- [`backend/tests/test_admin_course_lessons.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/tests/test_admin_course_lessons.py)

#### Not implemented

Goals still use hard delete:

- [`backend/app/routers/admin_settings.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/routers/admin_settings.py)

There is no unified delete strategy document or contract for:

- goals
- categories
- step templates

#### Status

`Partially done`

## Summary of What Remains

### High priority remaining scope

1. Finish admin students filters/sort in the frontend
2. Formalize backend sorting/query behavior for admin students
3. Replace scattered `window.confirm` usage with one reusable destructive-action dialog
4. Decide and implement goal delete strategy

### Lower priority scope

1. Consider extending the same safe-delete pattern to categories and step templates even though they are not explicitly named in the epic
2. Add URL persistence for admin list filters if the team wants bookmarkable admin searches

## Recommended Delivery Order

1. `BE-SOFT-DELETE-DECISION`
2. `BE-ADMIN-STUDENTS-QUERY`
3. `FE-ADMIN-SAFE-DELETE`
4. `FE-ADMIN-STUDENTS-FILTERS`

Reason:

- delete strategy should be decided before frontend standardizes destructive UX
- backend query/sort contract should be stable before frontend adds sort/filter controls

## Backend Plan

### Workstream A: Admin Students Query Contract

#### Objective

Turn the current admin students list into an explicitly supported query API for filtering and sorting.

#### Existing base

- [`backend/app/routers/admin_students.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/app/routers/admin_students.py)

#### Backend tasks

1. Keep current support for `status`, `role`, `q`, `limit`
2. Decide whether `cursor` is:
   - implemented now, or
   - removed from contract for `v0.9`
3. Add explicit sort support:
   - `createdAt`
   - `progress`
   - `activity` if there is a real source field; otherwise defer
4. Ensure ordering is stable and deterministic even when field values tie
5. Update OpenAPI if query params change

#### Recommended contract

- `sortBy=createdAt|progress`
- `sortDir=asc|desc`

Recommendation:

- implement `createdAt` and `progress`
- defer `activity` unless there is a trustworthy backend field already present

#### Technical notes

- `q` is currently in-memory after fetching; acceptable for small datasets but should be documented as a temporary approach
- if `progress` sorting stays in-memory, ensure the final order is still deterministic with a tie-breaker on `uid` or `createdAt`

#### Backend acceptance

- `/api/admin/students` supports documented filters and sort modes
- behavior is deterministic
- tests cover role/status/q/sort combinations

### Workstream B: Delete Strategy

#### Objective

Close the soft-delete decision and make behavior consistent across admin-managed entities.

#### Existing base

- courses and lessons already soft-delete via `isActive`
- goals still hard delete

#### Backend tasks

1. Decide strategy for goals:
   - option A: keep hard delete
   - option B: move to `isActive`

Recommendation:

- move goals to soft delete if goals may be referenced by onboarding selections, student plans, courses, or analytics

2. If goals move to soft delete:
   - extend goal schema with `isActive`
   - filter student-facing goal lists to active only
   - decide whether admin list should show all by default or active-only with filter
3. If goals remain hard delete:
   - document allowed preconditions
   - reject delete when linked entities still exist

#### Recommendation

For this codebase, soft delete is the safer path for goals because goals are referenced in multiple places:

- onboarding
- student plans
- course mappings

Hard delete is likely to create data integrity surprises unless every reference path is cleaned up.

#### Backend acceptance

- delete behavior is documented and consistent
- user-facing goal/course selection excludes inactive entities
- tests cover the chosen goal deletion path

## Frontend Plan

### Workstream C: Admin Students Filters and Sort

#### Objective

Upgrade the students directory to a practical operational tool.

#### Existing base

- [`frontend/src/routes/admin/AdminStudents.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStudents.tsx)

#### Frontend tasks

1. Add filter controls:
   - status
   - role
2. Add sort controls:
   - created date
   - progress
   - activity only if backend supports it
3. Preserve current split view only if still valuable

Recommendation:

- replace the hardcoded student/staff dual-fetch layout with one unified filterable directory, or
- keep the split layout but still allow explicit filter chips and sort controls above it

Preferred `v0.9` approach:

- one shared search/filter toolbar
- one students section
- one staff section
- both driven by the same search term, with separate role values underneath

4. Persist filter state in the URL if inexpensive
5. Improve empty state messaging:
   - “No students match current filters”
   - “No staff match current filters”

#### Acceptance

- staff can filter by status and role
- staff can sort by at least created date and progress
- the UI reflects active filters clearly

### Workstream D: Reusable Safe Delete UX

#### Objective

Replace browser confirms with one reusable destructive action modal.

#### Existing base

- typed confirmation dialogs already exist in [`frontend/src/routes/admin/AdminStudentProfile.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/src/routes/admin/AdminStudentProfile.tsx)

#### Frontend tasks

1. Extract a reusable destructive-confirm dialog component
2. Support two modes:
   - acknowledge only
   - typed keyword confirmation
3. Roll it out to:
   - goals
   - courses
   - lessons
4. Optionally extend to:
   - categories
   - step templates

#### Recommended API for the component

- title
- description
- confirmLabel
- confirmKeyword optional
- loading
- destructive intent styling
- `onConfirm`

#### Acceptance

- no `window.confirm` remains on major admin CRUD screens
- destructive flows are visually consistent
- keyword-confirm flows are used where deletion is high-risk

## Cross-Team Decisions Needed

### 1. Student directory shape

Decide whether admin students should remain:

- split into `Students` and `Staff`

or become:

- one unified table/list with role filter

Recommendation:

- keep the split sections for `v0.9`, because it matches the current mental model and requires less UI churn

### 2. Goal deletion strategy

Decision required:

- soft delete
- hard delete with safety checks

Recommendation:

- soft delete goals

### 3. Sorting by activity

Current epic text mentions `activity`, but there is no obvious, clean backend field exposed for that today.

Recommendation:

- defer `activity` sort unless the team defines one canonical field such as `updatedAt`, `lastSeenAt`, or `lastStepCompletedAt`

## QA Plan

### Backend

Extend tests in:

- [`backend/tests/test_admin_students.py`](/Users/stinger/Work/Lab18/StoryWalkers/backend/tests/test_admin_students.py)
- goal/courses tests if delete strategy changes

Add coverage for:

- status + role + q combination filters
- deterministic sorting
- goal delete behavior according to the chosen strategy

### Frontend

Extend tests in:

- [`frontend/tests/admin/AdminStudents.test.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/tests/admin/AdminStudents.test.tsx)
- [`frontend/tests/admin/AdminStudentProfile.test.tsx`](/Users/stinger/Work/Lab18/StoryWalkers/frontend/tests/admin/AdminStudentProfile.test.tsx)
- add or update tests for `AdminGoals`, `AdminCourses`, and lesson screens

Add coverage for:

- filter toolbar behavior
- sort control behavior
- destructive confirmation modal behavior
- empty states under filtered results

## Definition of Done

- Admin students backend query contract is explicit and tested
- Admin students frontend has status/role filters and practical sort controls
- Destructive admin actions use a shared confirmation UX instead of `window.confirm`
- Goal delete strategy is explicitly chosen and implemented
- Student-facing onboarding/catalog respects inactive entities
- Relevant backend and frontend tests pass

## Delivery Summary

### Already implemented

- backend student list filtering by `status`, `role`, `q`, `limit`
- stable base ordering by `createdAt`
- progress counters on admin students list
- student delete with typed confirmation
- courses and lessons soft delete through `isActive`
- onboarding excludes inactive courses

### Still to implement

- frontend status/role filters and sort for admin students
- backend sort contract and cursor decision for admin students
- reusable safe delete modal across goals/courses/lessons
- goal soft-delete vs hard-delete final implementation
