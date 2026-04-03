# Development Plan: EPIC-UX — UX Polish

- **Epic key:** `EPIC-UX`
- **Title:** UX Polish (progress, locked states, naming, loaders)
- **Target date:** 2026-03-31
- **Priority:** P1
- **Size:** L · Estimate: 6 pts
- **Branch prefix:** `feature/ux-polish`

---

## Overview

Four frontend-only tasks that improve perceived quality across student and admin surfaces:
rename confusing terms, add progress visualization, add locked/unlocked visual states for lessons,
and replace raw text loading states with skeleton loaders and consistent empty states.

No backend changes required for this epic. All tasks are independent and can be parallelized
between developers after a shared prep step (terminology audit).

---

## Task 1 — FE-RENAME-TERMS

**Title:** Rename UI terms (Edit → Manage, Step → Lesson)
**Estimate:** 1 pt · **Target:** 2026-03-27

### Context

The codebase has a historical split:
- "Step" is used in student plan context (backend model: `PlanStep`, `stepCompletions`)
- "Lesson" is used in the courses/admin context (backend model: `AdminLesson`)

The rename is **UI-only**: do not change API field names, Firestore collection names,
TypeScript type names, or function names in API clients. Only update visible labels, page titles,
breadcrumbs, navigation text, and i18n strings.

### Changes

#### `frontend/src/lib/i18n.tsx` — both `en` and `ru` locale objects

Update the following i18n keys (English → updated label, keep keys intact):

| Key | Old value | New value |
|-----|-----------|-----------|
| `student.home.stepsTitle` | `"Steps"` | `"Lessons"` |
| `student.home.currentStepTitle` | `"Current step"` | `"Current lesson"` |
| `student.home.currentStepDescription` | `"Focus on the next unfinished step in your path."` | `"Focus on the next unfinished lesson in your path."` |
| `student.home.currentStepLabel` | `"Up next"` | `"Up next"` *(no change)* |
| `student.home.currentStepMarkDone` | `"Mark done"` | `"Mark done"` *(no change)* |
| `student.home.currentStepEmpty` | `"You've completed every step. Nice work!"` | `"You've completed every lesson. Nice work!"` |
| `student.home.completeDialogDriveHelpStep1..4` | *(keep as-is, they describe Google Drive steps, not app steps)* | *(no change)* |

Russian equivalents follow the same logic — replace "шаг/шаги" with "урок/уроки" where they
refer to the student plan steps (not Google Drive steps in help text).

#### `frontend/src/routes/admin/AdminCourses.tsx`

- Button label `"Edit"` (line ~309) on the course list row → `"Manage"`
- Form section title `"Edit course"` (line ~337) → `"Edit course"` *(keep — this is a form header, not nav)*

#### `frontend/src/routes/admin/AdminCourseLessons.tsx`

- Toast `"Lesson updated"` / `"Lesson created"` / `"Lesson deactivated"` / `"Lesson content updated"` — **no change needed**, already uses "Lesson"
- Dialog title `"Edit content"` (line ~629) → `"Edit content"` *(keep — refers to lesson content, not nav)*

#### `frontend/src/routes/admin/AdminHome.tsx`

- Section heading `"Step Completions"` (line ~83) → `"Lesson Completions"`
  Note: the route `/admin/step-completions` and component name `AdminStepCompletions` do **not** change.

#### `frontend/src/routes/admin/AdminLibrary.tsx` and `AdminLibraryDetail.tsx`

- Button `"Edit"` in library list rows → `"Manage"` (align with courses pattern)
- Page breadcrumb `"Edit"` in `AdminLibraryDetail.tsx` (line ~165) → `"Edit"` *(keep — it is a form action, acceptable)*

### Acceptance criteria

- Student home shows "Lessons" and "Current lesson" in both English and Russian
- No TypeScript errors, no API field name changes
- Admin home section reads "Lesson Completions"
- "Edit" row-action button on courses and library lists reads "Manage"

---

## Task 2 — FE-PROGRESS-BAR

**Title:** Progress UI (course progress bar + counters)
**Estimate:** 2 pts · **Target:** 2026-03-29

### Context

A progress bar already exists in `StudentHome.tsx` (lines 138, 157) for the student's **plan steps**.
This task extends progress visualization to:
1. **Student Home** — ensure the existing bar is production-quality (always visible, labelled)
2. **Course cards** in onboarding course selection — show per-course lesson count
3. **Admin Student Profile** — the existing `{progress()}% complete` badge may need the bar too

Progress is computed client-side from loaded data; no new backend endpoint needed.

### Sub-tasks

#### 2a. Audit and harden existing StudentHome progress bar

File: `frontend/src/routes/student/StudentHome.tsx`

Current state (lines ~138, ~157):
```tsx
{t('student.home.progressComplete', { percent: progress().percent })}
// ...
<div style={{ width: `${progress().percent}%` }} />
```

Improvements:
- Ensure bar is always rendered (even at 0%), not conditionally hidden
- Add `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes on the bar container
- Add `done/total` counter next to the percent badge: `"3 / 10 lessons done"`
- Add new i18n key `student.home.progressCounter` = `"{done} / {total} lessons done"` (ru: `"{done} из {total} уроков выполнено"`)

#### 2b. Add a reusable `ProgressBar` component

File: `frontend/src/components/ui/progress-bar.tsx` *(new file)*

```tsx
// Props: value (0–100), class?
// Renders: accessible div with inner fill div
// Use existing `bg-muted` and `bg-primary` tokens
// Height: h-2, rounded-full (matches existing inline style in StudentHome)
```

Replace the inline progress bar in `StudentHome.tsx` with `<ProgressBar value={progress().percent} />`.

#### 2c. Lesson count badge on course cards (Onboarding)

File: `frontend/src/routes/onboarding/OnboardingCourses.tsx`
Depends on: course data returned by `GET /courses` (should include `lessonCount` or the FE computes it).

- If `GET /courses` returns `lessonCount` per course: show `"{n} lessons"` badge on each course card using `SmallStatBadge`
- If not available yet: show nothing (do not block the task — mark this as "if data available"
  and coordinate with backend on whether `lessonCount` is exposed)

#### 2d. Add i18n keys

New keys to add in both locales:

| Key | EN | RU |
|-----|----|----|
| `student.home.progressCounter` | `"{done} / {total} lessons done"` | `"{done} из {total} уроков выполнено"` |
| `onboarding.courses.lessonCount` | `"{count} lessons"` | `"{count} уроков"` |

### Acceptance criteria

- Student home shows `"3 / 10 lessons done"` counter next to `"30% complete"` badge
- Progress bar is accessible (ARIA attributes present)
- `ProgressBar` component is used in StudentHome
- Onboarding course cards show lesson count if available from API

---

## Task 3 — FE-LOCKED-STATE

**Title:** Locked/Unlocked lesson states (visual)
**Estimate:** 1 pt · **Target:** 2026-03-30

### Context

For v0.9, all lessons are effectively unlocked (students can access all steps in their plan).
This task adds the **visual infrastructure** for locked/unlocked states so it can be wired to
real locking logic later without a UI rewrite.

The locking rule for v0.9: a lesson is **visually unlocked** always. Future versions may lock
lessons until prerequisite steps are done — the component should accept an `isLocked` prop.

### Changes

#### 3a. Extend `PlanStep` display in `StudentHome.tsx`

Current step cards show:
- Icon: `check_circle` (done) or `schedule` (pending)
- Title, description, material link, mark-done button

Add locked state:
- New icon variant: `lock` (Material Icons) for locked lessons
- When `isLocked = true`:
  - Show `lock` icon instead of `schedule`
  - Mute the card: reduce opacity (`opacity-60`) or use `text-muted-foreground` on title
  - Disable "Open" and "Mark done" buttons (`disabled`)
  - Add tooltip or small label: `"Complete previous lessons first"` (i18n key: `student.home.stepLocked`)

For v0.9, `isLocked` is always `false` — derived from `step.order > 0 && false` (placeholder).
Add a comment: `// TODO: implement sequential locking in future epic`.

#### 3b. i18n key

| Key | EN | RU |
|-----|----|----|
| `student.home.stepLocked` | `"Complete previous lessons first"` | `"Сначала завершите предыдущие уроки"` |

#### 3c. Optional: Locked badge on course cards

If course cards are shown in `StudentHome` or elsewhere, add `Lock` icon badge for locked courses.
For v0.9: skip unless course-level locking is already in scope.

### Acceptance criteria

- `StudentHome` step list supports `isLocked` prop on step display (even if always `false` for v0.9)
- Locked step shows lock icon + muted styling + disabled buttons
- No regression in existing step completion flow (mark done, open material)

---

## Task 4 — FE-SKELETONS

**Title:** Skeleton loaders + empty states
**Estimate:** 1 pt · **Target:** 2026-03-31

### Context

`Skeleton` component exists at `frontend/src/components/ui/skeleton.tsx` (Kobalte-based,
`bg-primary/10 animate-pulse`). It is not yet used consistently — most loading states are
either raw `animate-pulse` divs (StudentHome) or simple text.

`Loading.tsx` exists as a 3-dot spinner — it should remain for action-level loading
(e.g., submitting a form). Skeletons replace page/list-level loading states.

### Changes

#### 4a. Replace inline `animate-pulse` divs in `StudentHome.tsx` with `<Skeleton>`

Lines ~80–87 in `StudentHome.tsx` contain manual `animate-pulse` divs.
Replace each with `<Skeleton class="h-10 w-56" />`, `<Skeleton class="h-24 rounded-lg" />`, etc.
This uses the centralized `Skeleton` component for consistency.

#### 4b. Add skeleton loaders to admin list pages

For each of the following pages, add a skeleton fallback in the `<Show when={!loading()} fallback={...}>`:

| File | Skeleton pattern |
|------|-----------------|
| `frontend/src/routes/admin/AdminCourses.tsx` | 3–4 row skeletons: `<Skeleton class="h-12 w-full" />` |
| `frontend/src/routes/admin/AdminGoals.tsx` | 3 row skeletons |
| `frontend/src/routes/admin/AdminStudents.tsx` | 5 row skeletons (table rows) |
| `frontend/src/routes/admin/AdminCourseLessons.tsx` | 4 row skeletons |

Pattern to use:
```tsx
// In <Show fallback={...}>
<div class="space-y-2">
  <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
  <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
  <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
</div>
```

#### 4c. Consistent empty states

Add a reusable `EmptyState` inline pattern (not a new component — keep it inline for now):

```tsx
// When list is loaded but empty:
<div class="py-8 text-center text-sm text-muted-foreground">
  {emptyMessage}
</div>
```

Apply to:
- `AdminCourses.tsx` — `"No courses yet. Create one above."`
- `AdminGoals.tsx` — `"No goals yet."`
- `AdminCourseLessons.tsx` — `"No lessons yet. Add one above."`
- `AdminStudents.tsx` — `"No students found."` (already may have a message — verify and normalize)

#### 4d. i18n keys for empty states

Add to both locales:

| Key | EN | RU |
|-----|----|----|
| `admin.courses.empty` | `"No courses yet. Create one above."` | `"Курсы не добавлены. Создайте первый выше."` |
| `admin.goals.empty` | `"No goals yet."` | `"Цели не добавлены."` |
| `admin.lessons.empty` | `"No lessons yet. Add one above."` | `"Уроки не добавлены. Добавьте первый выше."` |
| `admin.students.empty` | `"No students found."` | `"Студенты не найдены."` |

### Acceptance criteria

- Admin list pages show skeleton placeholders while loading (not blank screens or spinners)
- Empty list states show a consistent centered message
- `StudentHome` loading skeleton uses `<Skeleton>` component, not raw inline divs
- No visual regressions on existing loading flows

---

## Implementation order

Tasks are mostly independent, but the following ordering is recommended:

```
Day 1 (2026-03-27):
  Dev A → Task 1 (FE-RENAME-TERMS) — small, touches i18n and labels only

Day 2–3 (2026-03-28–29):
  Dev A → Task 2 (FE-PROGRESS-BAR) — create ProgressBar component, harden StudentHome
  Dev B → Task 4 (FE-SKELETONS) — skeleton audit across admin pages (can run in parallel)

Day 4 (2026-03-30):
  Dev A or B → Task 3 (FE-LOCKED-STATE) — depends on Task 1 (terminology settled)
```

---

## Key files summary

| File | Task(s) | Change type |
|------|---------|-------------|
| `frontend/src/lib/i18n.tsx` | 1, 2, 3, 4 | Add/update i18n strings (EN + RU) |
| `frontend/src/routes/student/StudentHome.tsx` | 1, 2, 3, 4 | Update labels, progress bar, locked state, skeleton |
| `frontend/src/routes/admin/AdminHome.tsx` | 1 | Rename "Step Completions" → "Lesson Completions" |
| `frontend/src/routes/admin/AdminCourses.tsx` | 1, 4 | "Edit" → "Manage" button, add skeleton + empty state |
| `frontend/src/routes/admin/AdminGoals.tsx` | 4 | Add skeleton + empty state |
| `frontend/src/routes/admin/AdminStudents.tsx` | 4 | Add skeleton + empty state |
| `frontend/src/routes/admin/AdminCourseLessons.tsx` | 4 | Add skeleton + empty state |
| `frontend/src/routes/admin/AdminLibrary.tsx` | 1 | "Edit" → "Manage" button |
| `frontend/src/routes/onboarding/OnboardingCourses.tsx` | 2 | Lesson count badge (if API provides count) |
| `frontend/src/components/ui/progress-bar.tsx` | 2 | **New** reusable component |

---

## Out of scope for this epic

- Backend changes (all progress is computed client-side from loaded data)
- Sequential lesson locking logic (visual infrastructure only for v0.9)
- Student-facing course detail pages (not yet in scope for v0.9)
- Renaming TypeScript types, API field names, or Firestore collections
- `AdminStepCompletions` component rename (route URL and component name stay as-is)
