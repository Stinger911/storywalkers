# EPIC-ADMIN Development Plan

## Source

- Epic: `EPIC-ADMIN`
- Title: `EPIC: Admin Improvements (filters/sort + safe delete + usability)`
- Source file: [`gh-items.nogit.json`](../gh-items.nogit.json)
- Milestone: `v0.9` (due 2026-04-19)
- Target date: 2026-03-22
- Estimate: 5 pts

### Epic tasks

| Key | Title | Size | Estimate |
|-----|-------|------|----------|
| `BE-ADMIN-STUDENTS-QUERY` | BE: Admin students list supports filters (status/role/q) | S | 2 pts |
| `FE-ADMIN-STUDENTS-FILTERS` | FE: Admin Students — filters and sort | M | 2 pts |
| `FE-ADMIN-SAFE-DELETE` | FE: Double confirm delete modal (type DELETE) | S | 1 pt |
| `BE-SOFT-DELETE-DECISION` | BE: Decide delete strategy (hard vs soft) + implement for courses/goals | M | 2 pts |

---

## Epic Goal

Improve the admin students module so staff can:

- find and filter students quickly by status and role with predictable sort order
- delete or deactivate entities safely with a typed confirmation
- work with consistent, reusable destructive action dialogs across all admin CRUD screens

---

## Implementation Status

### `BE-ADMIN-STUDENTS-QUERY`

**Status: Partially done (85%)**

#### Already implemented

File: [`backend/app/routers/admin_students.py`](../backend/app/routers/admin_students.py)

Query params already supported on `GET /api/admin/students`:

- `status` — validated against `UserStatus` enum
- `role` — defaults to `"student"`; maps `"staff"` → `["admin", "expert"]` via `where("role", "in", …)`
- `q` — in-memory filter on `email` and `displayName` (case-insensitive)
- `limit` — range 1–100, default 50
- `cursor` — declared but silently ignored

Ordering: stable `createdAt` ascending.

Response includes progress fields: `progressPercent`, `stepsDone`, `stepsTotal`.

Tests: [`backend/tests/test_admin_students.py`](../backend/tests/test_admin_students.py)

#### Not implemented

- `cursor` pagination is a stub — the param is accepted but has no effect
- No `sortBy` or `sortDir` params — only `createdAt` asc is supported
- No `activity` sort field exists on the backend data model

#### Remaining tasks

1. Implement `cursor`-based pagination: accept `cursor` as the `uid` of the last item received; resolve it to a Firestore document snapshot and pass to `start_after()`; add `uid` as a secondary sort key for stable pagination when `createdAt` ties.
2. Add `sortBy=createdAt|progress` and `sortDir=asc|desc` query params.
3. Implement `progress` sort in-memory with a stable tie-breaker (secondary sort on `uid`).
4. Defer `activity` sort — no canonical field exists for it yet.
5. Update OpenAPI spec for the new `sortBy`, `sortDir`, and the now-working `cursor` params.
6. Extend tests to cover `sortBy`/`sortDir` combinations, cursor pagination, and edge cases.

---

### `FE-ADMIN-STUDENTS-FILTERS`

**Status: Partially done (20%)**

#### Already implemented

File: [`frontend/src/routes/admin/AdminStudents.tsx`](../frontend/src/routes/admin/AdminStudents.tsx)

- Search box wired to the `q` param
- Separate hardcoded API calls for `role=student` and `role=staff` — no interactive role selector
- Progress counters displayed per student row
- `listStudents()` in [`frontend/src/lib/adminApi.ts`](../frontend/src/lib/adminApi.ts) accepts `status`, `role`, `q`, `limit`

#### Not implemented

- No `status` filter UI (no dropdown for active/disabled/community_only/expired)
- No `role` filter UI — role is hardcoded via two separate fetches, not a picker
- No sort UI (no sort-by or direction controls)
- No URL persistence for filter/sort state
- No empty state messages per filtered section

#### Remaining tasks

1. Add a shared filter toolbar above the student list:
   - `status` dropdown: All / active / disabled / community_only / expired
   - `role` is already split (students / staff sections) — keep split layout, apply the shared search and status filter to both sections via separate `listStudents()` calls with the correct `role` value
2. Add sort controls (at minimum `createdAt` and `progress`; defer `activity`).
3. Persist `status`, `q`, and `sortBy`/`sortDir` in the URL search params so filters survive refresh and are bookmarkable.
4. Add filtered empty state messages: `"No students match current filters"`, `"No staff match current filters"`.
5. Extend or create tests in [`frontend/tests/admin/AdminStudents.test.tsx`](../frontend/tests/admin/AdminStudents.test.tsx).

**Note on layout**: keep the current Students / Staff split for v0.9 — replacing it with a unified table is higher churn for no user-facing gain in this milestone.

---

### `FE-ADMIN-SAFE-DELETE`

**Status: Partially done (40%)**

#### Already implemented

File: [`frontend/src/routes/admin/AdminStudentProfile.tsx`](../frontend/src/routes/admin/AdminStudentProfile.tsx)

- Student delete dialog requires:
  1. checking an acknowledgment checkbox
  2. typing `DELETE` exactly into a text field
- Plan steps reset dialog uses the same pattern but requires `RESET_STEPS`
- Both dialogs are visually consistent and use the shared `Dialog` component

File: [`frontend/tests/admin/AdminStudentProfile.test.tsx`](../frontend/tests/admin/AdminStudentProfile.test.tsx) — tests exist for the delete flow.

#### Not implemented — places still using `window.confirm`

| File | Action |
|------|--------|
| [`frontend/src/routes/admin/AdminGoals.tsx`](../frontend/src/routes/admin/AdminGoals.tsx) | Delete goal |
| [`frontend/src/routes/admin/AdminCourses.tsx`](../frontend/src/routes/admin/AdminCourses.tsx) | Deactivate / delete course |
| [`frontend/src/routes/admin/AdminStepTemplates.tsx`](../frontend/src/routes/admin/AdminStepTemplates.tsx) | Delete step template |
| Admin categories | Delete category |
| Admin lessons | Delete lesson (verify) |

#### Remaining tasks

1. Extract a reusable `DestructiveConfirmDialog` component — suggested props:

   ```ts
   type DestructiveConfirmDialogProps = {
     open: boolean
     onOpenChange: (open: boolean) => void
     title: string
     description: string
     confirmKeyword?: string          // if set, user must type this word
     loading?: boolean
     onConfirm: () => void | Promise<void>
   }
   ```

2. Roll out to goals, courses, and lessons (highest-risk deletions first).
3. Optionally extend to categories and step templates (lower risk, but improves consistency).
4. Remove all remaining `window.confirm` usage from major admin CRUD screens.
5. Write unit tests for the new component covering:
   - confirm button disabled until keyword matches
   - confirm button enabled when keyword typed correctly
   - loading state during deletion

---

### `BE-SOFT-DELETE-DECISION`

**Status: Partially done (60%)**

#### Already implemented

**Courses — soft delete** via `isActive`:

- Repository: [`backend/app/repositories/courses.py`](../backend/app/repositories/courses.py) — `soft_delete_course()` sets `isActive=False`
- Router: [`backend/app/routers/admin_courses.py`](../backend/app/routers/admin_courses.py) — `DELETE /admin/courses/{id}` calls `soft_delete_course()`
- Admin list supports `is_active` filter parameter
- Student-facing endpoint filters to `isActive=True` only: [`backend/app/routers/courses.py`](../backend/app/routers/courses.py)

**Lessons — soft delete** via `isActive`:

- Repository: `soft_delete_lesson()` sets `isActive=False`
- Router: `DELETE /admin/courses/{course_id}/lessons/{lesson_id}` calls `soft_delete_lesson()`

Tests: [`backend/tests/test_admin_courses.py`](../backend/tests/test_admin_courses.py), [`backend/tests/test_courses_api.py`](../backend/tests/test_courses_api.py), [`backend/tests/test_admin_course_lessons.py`](../backend/tests/test_admin_course_lessons.py)

#### Not implemented

**Goals — hard delete**:

- [`backend/app/routers/admin_settings.py`](../backend/app/routers/admin_settings.py) — `DELETE /admin/goals/{id}` calls `doc_ref.delete()` directly
- No `isActive` field in goal schema
- Goals are referenced in: onboarding step, student plans, course `goalIds` mapping → hard delete creates dangling references

**Categories and step templates — hard delete** (no `isActive`):

- Lower risk than goals; categories and step templates are not referenced elsewhere in the data model in the same way

#### Decision

**Soft delete goals** — the safer choice for v0.9 because goals are referenced in multiple places. Hard delete without cascade cleanup leads to data integrity surprises in onboarding and plan displays.

Categories and step templates can remain hard delete for v0.9 (simpler, fewer references). Document this explicitly.

#### Remaining tasks

1. Add `isActive: bool = True` to the goal schema (`GoalBase` or equivalent).
2. Add `soft_delete_goal()` to the goals repository (or inline in the router).
3. Change `DELETE /admin/goals/{id}` to set `isActive=False` instead of calling `doc_ref.delete()`.
4. Filter student-facing goal lists to `isActive=True` (onboarding step picker and any public goals endpoint).
5. Decide admin goal list default: show active-only or all with an `isActive` toggle — recommend active-only by default with an "Include inactive" toggle.
6. Update frontend admin goals list (`AdminGoals.tsx`) to handle and display `isActive` state (show deactivated label; provide reactivate button).
7. Add tests for:
   - soft-delete goal is excluded from onboarding goal list
   - soft-delete goal is still returned when admin requests include-inactive
   - hard delete blocked if goal is still referenced (optional, deferred)

---

## Cross-Team Decisions Required

### 1. Cursor pagination for admin students

**Options:**
- A. Implement `cursor`-based pagination now (requires Firestore cursor from `createdAt` + `uid`).
- B. Remove `cursor` param from contract for v0.9, document limit-only pagination.

**Decision: Option A — implement cursor now.**

Use a Firestore document snapshot cursor: the client sends the `uid` of the last item received; the backend resolves it to a document snapshot and passes it to `start_after()`. Secondary sort on `uid` ensures stable pagination when `createdAt` values tie.

### 2. `activity` sort field

**Problem:** The epic spec lists `activity` as a sort option but no canonical field exists in the data model (`updatedAt` is on the user doc but does not represent last login or last lesson action).

**Options:**
- A. Define `lastSeenAt` or `lastActionAt` and populate it from relevant endpoints.
- B. Defer `activity` sort until the field exists.

**Decision: Option B — defer `activity` sort.** Expose only `createdAt` and `progress` sort options for v0.9.

### 3. Goal delete strategy

Confirmed above: soft delete. See `BE-SOFT-DELETE-DECISION` remaining tasks.

---

## Recommended Delivery Order

```
1. BE-SOFT-DELETE-DECISION       ← unblocks FE safe-delete for goals
2. BE-ADMIN-STUDENTS-QUERY       ← unblocks FE filter/sort UI
3. FE-ADMIN-SAFE-DELETE          ← extract component, roll out
4. FE-ADMIN-STUDENTS-FILTERS     ← add filter toolbar + sort
```

---

## Backend Workstream Detail

### Workstream A — Admin Students Query (`BE-ADMIN-STUDENTS-QUERY`)

**File:** `backend/app/routers/admin_students.py`

**Changes:**

1. Implement cursor pagination:
   - Accept `cursor: str | None = Query(None)` as the `uid` of the last item from the previous page.
   - Before executing the Firestore query, resolve `cursor` to a document snapshot via `db.collection("users").document(cursor).get()` and pass it to `query.start_after(snapshot)`.
   - Add `uid` as a secondary sort key (`query.order_by("createdAt").order_by("uid")`) to guarantee stable ordering when `createdAt` values tie.
   - Return a `nextCursor` field in the response (the `uid` of the last item returned, or `null` if the page is the last one).

2. Add `sortBy` and `sortDir`:

   ```python
   sort_by: str | None = Query(None, alias="sortBy")   # createdAt | progress
   sort_dir: str = Query("desc", alias="sortDir")       # asc | desc
   ```

3. After fetching and enriching items with progress, apply in-memory sort:
   - `createdAt`: re-sort on the `createdAt` timestamp to support `asc`/`desc` flip; use `uid` as tie-breaker.
   - `progress`: sort on `progressPercent` descending by default; `uid` as tie-breaker.

4. Add a validation helper that rejects unknown `sortBy` values with HTTP 400.

5. Ensure tests cover:
   - `sortBy=createdAt&sortDir=asc` and `desc`
   - `sortBy=progress&sortDir=desc`
   - combined `status` + `role` + `q` + `sortBy`
   - cursor pagination: first page returns `nextCursor`; second page with `cursor=<uid>` returns next set
   - cursor with unknown `uid` returns HTTP 404

---

### Workstream B — Goal Soft Delete (`BE-SOFT-DELETE-DECISION`)

**Files:**

- `backend/app/schemas/` — goal schema
- `backend/app/repositories/` — goal repository or inline logic
- `backend/app/routers/admin_settings.py` — goal delete endpoint
- `backend/app/routers/` — any student-facing goal listing

**Changes:**

1. Schema: add `isActive: bool = True` to `GoalBase`.

2. Repository (new function or inline):
   ```python
   def soft_delete_goal(db, goal_id: str) -> bool:
       ref = db.collection("goals").document(goal_id)
       if not ref.get().exists:
           return False
       ref.update({"isActive": False, "updatedAt": firestore.SERVER_TIMESTAMP})
       return True
   ```

3. Router change in `admin_settings.py`:
   - `DELETE /admin/goals/{id}` → call `soft_delete_goal()` instead of `doc_ref.delete()`

4. Student-facing goal list (onboarding):
   - Add `.where("isActive", "==", True)` filter to goal queries exposed to students.

5. Admin goal list: add optional `is_active: bool | None = Query(None)` param. Default behaviour: return active goals only. Pass `is_active=false` to see deactivated ones.

---

## Frontend Workstream Detail

### Workstream C — Admin Students Filters and Sort (`FE-ADMIN-STUDENTS-FILTERS`)

**File:** `frontend/src/routes/admin/AdminStudents.tsx`

**Approach:** keep the current Students / Staff two-section layout; share a single filter toolbar between both sections.

**State:**
```ts
const [statusFilter, setStatusFilter] = createSignal<string>("")
const [q, setQ] = createSignal("")
const [sortBy, setSortBy] = createSignal<"createdAt" | "progress">("createdAt")
const [sortDir, setSortDir] = createSignal<"asc" | "desc">("desc")
```

Persist all four values in `URLSearchParams` so they survive page reload.

**Toolbar UI:**

- Existing search box — wire to `q` signal
- `<Select>` for status: All / active / disabled / community_only / expired
- `<Select>` for sort: Created (newest first) / Created (oldest first) / Progress (highest)
- Both sections (students, staff) pass the same `status`, `q`, `sortBy`, `sortDir` to separate `listStudents({ role: "student", ... })` and `listStudents({ role: "staff", ... })` calls

**Empty states:**

- `"No students match the current filters."` (shown when student list is empty and any filter is active)
- `"No staff match the current filters."` (same for staff section)

---

### Workstream D — Reusable Safe Delete Modal (`FE-ADMIN-SAFE-DELETE`)

**Step 1 — extract component**

Create `frontend/src/components/DestructiveConfirmDialog.tsx`:

```tsx
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmKeyword?: string   // e.g. "DELETE"; if omitted, shows checkbox only
  loading?: boolean
  onConfirm: () => Promise<void>
}
```

- If `confirmKeyword` is provided: show text input, enable Confirm button only when input matches keyword exactly (case-sensitive).
- If not provided: show acknowledgment checkbox; enable Confirm button when checked.
- Confirm button uses `variant="destructive"`.
- While `loading` is true: disable controls and show spinner on button.

**Step 2 — migrate existing usage**

Replace the inline delete dialog in `AdminStudentProfile.tsx` with the new component to validate it.

**Step 3 — roll out**

| Screen | Action | Keyword |
|--------|--------|---------|
| `AdminGoals.tsx` | Delete goal | `"DELETE"` |
| `AdminCourses.tsx` | Deactivate course | none (checkbox only — soft delete) |
| Admin lessons | Delete lesson | `"DELETE"` |
| `AdminStepTemplates.tsx` | Delete step template | `"DELETE"` |
| Categories | Delete category | `"DELETE"` |

**Step 4 — tests**

File: `frontend/tests/components/DestructiveConfirmDialog.test.tsx`

Cover:
- Confirm button disabled initially
- Confirm button enabled when keyword typed exactly
- Confirm button disabled when keyword typed incorrectly
- Checkbox-only mode: enabled after checkbox checked
- Loading state: all controls disabled

---

## QA Plan

### Backend tests to extend

File: `backend/tests/test_admin_students.py`

- `sortBy=createdAt asc/desc`
- `sortBy=progress desc`
- combined filter + sort
- invalid `sortBy` value returns 400
- cursor pagination: first page returns correct `nextCursor`
- cursor pagination: second page starts after last item of first page
- cursor with unknown `uid` returns 404

File: `backend/tests/test_admin_settings.py` (or new `test_admin_goals.py`)

- soft delete goal: excluded from student-facing list
- soft delete goal: still returned in admin list with `is_active=false`
- reactivate goal: reappears in student-facing list

### Frontend tests to extend

File: `frontend/tests/admin/AdminStudents.test.tsx`

- status filter drives API call with correct param
- sort controls drive API call with correct `sortBy`/`sortDir`
- empty state shown when response is empty and filter is active
- filter state persisted in URL

File: `frontend/tests/admin/AdminStudentProfile.test.tsx`

- existing delete tests should pass unchanged after refactor to `DestructiveConfirmDialog`

File: `frontend/tests/components/DestructiveConfirmDialog.test.tsx` (new)

- see Workstream D tests above

---

## Definition of Done

- `GET /api/admin/students` supports documented `sortBy` and `sortDir` params with tested deterministic ordering
- `cursor` decision is documented: either implemented or formally removed from the API contract
- Admin students frontend has status filter, sort controls, and URL persistence
- `DestructiveConfirmDialog` component extracted and tested
- No `window.confirm` remains in major admin CRUD screens (goals, courses, lessons)
- Goals use soft delete (`isActive`); student-facing onboarding excludes inactive goals
- Onboarding and admin catalog respect `isActive` for both courses and goals
- All new and changed backend routes have test coverage
- All new frontend components have unit tests

---

## Delivery Summary

### Already implemented

- `GET /api/admin/students` supports `status`, `role`, `q`, `limit` filtering
- Stable base ordering by `createdAt`
- Progress counters (`progressPercent`, `stepsDone`, `stepsTotal`) on admin student list
- Search box in admin students UI
- Student delete with typed `DELETE` confirmation in `AdminStudentProfile`
- Courses and lessons soft-delete via `isActive`; onboarding excludes inactive courses

### Still to implement

| Task | Status | Notes |
|------|--------|-------|
| `sortBy` / `sortDir` params on admin students list | Not started | See Workstream A |
| `cursor` pagination (Firestore `start_after`) | Not started | See Workstream A |
| Status and sort filter UI in AdminStudents | Not started | See Workstream C |
| URL persistence for filter state | Not started | Part of Workstream C |
| `DestructiveConfirmDialog` reusable component | Not started | See Workstream D |
| Replace `window.confirm` in goals/courses/lessons | Not started | Part of Workstream D |
| Goal soft delete (`isActive`) | Not started | See Workstream B |
| Student-facing goal list filtered to `isActive=True` | Not started | Part of Workstream B |
