# UI → Data → API Map (MVP) — Personalized Learning Pathways

This document maps each MVP screen to:

1. what data it needs,
2. where that data comes from (Firestore vs Backend API),
3. what user actions exist and how they are persisted.

Assumptions (MVP decisions):

- One plan per student: `student_plans/{uid}`
- Steps: `student_plans/{uid}/steps/{stepId}`
- Role stored in `users/{uid}.role`
- Students write only: step progress toggle, create questions (optional edit before answered)
- Staff uses backend for admin operations (plans, templates, answers, publish to library)

Source: spec :contentReference[oaicite:0]{index=0}

---

## Legend

**FS** = Firestore direct read/write (via client SDK + security rules)  
**API** = Python backend endpoint

---

## Public area

## 1) Login / Sign up

### Data needed

- none (auth-only)

### Source

- Firebase Auth (client)

### Actions

- Login / Signup / Logout (Firebase Auth)

### Notes

- After login, app loads `/me` (API) or reads `users/{uid}` (FS) to route to `/student` or `/admin`.

---

## Student area

## 2) Student Dashboard / “My Path”

### Data needed

- Current user (role, displayName)
- Current goal (title/description)
- Plan steps list (title, description, materialUrl, isDone, order)
- Progress summary (doneCount/totalCount)

### Source

- User profile:
  - Option A (recommended): **API** `GET /me`
  - Option B: **FS** `users/{uid}` (self)
- Plan:
  - **FS** `student_plans/{uid}`
- Goal details:
  - **FS** `goals/{goalId}` (recommended allow read)
  - Alternative: denormalize goal title into plan (not preferred)
- Steps:
  - **FS** `student_plans/{uid}/steps` ordered by `order ASC`

### Actions

- Toggle step done/undone:
  - **FS write** `student_plans/{uid}/steps/{stepId}`
  - Allowed fields: `isDone`, `doneAt`, (`updatedAt` optional)
- Open material link:
  - client-only navigation (no persistence)

### Notes

- Progress can be computed client-side from loaded steps.
- If you want aggregated progress for admin views later, add a backend job in v2.

---

## 3) Student Questions (list)

### Data needed

- List of own questions:
  - title, categoryId, status, updatedAt
- Category names for display (optional)

### Source

- Questions list:
  - Option A: **API** `GET /questions` (server filters by auth)
  - Option B: **FS** query `questions where studentUid == auth.uid`
- Categories for labels:
  - **FS** `categories/*` (read-only for students)

### Actions

- Open question details:
  - client navigation
- Create new question:
  - navigation to “Create Question”

### Notes

- Prefer API if you want consistent pagination and future search, but FS is fine for MVP.

---

## 4) Student Create Question

### Data needed

- Categories list (for select)

### Source

- Categories:
  - **FS** `categories/*`

### Actions

- Submit new question:
  - Option A: **API** `POST /questions`
  - Option B: **FS create** `questions/{questionId}` with:
    - `studentUid = auth.uid`
    - `status = "new"`
    - `answer = null`
    - timestamps

### Notes

- Safer to use API if you want dedup protection and server timestamps, but FS create is acceptable if rules are strict.

---

## 5) Student Question Details (view answer)

### Data needed

- Single question:
  - title, body, status
  - answer.text, answer.videoUrl (if answered)

### Source

- Option A: **API** `GET /questions` + filter by id (or add `GET /questions/{id}` in implementation)
- Option B: **FS** read `questions/{id}` (rules: only if `studentUid == auth.uid`)

### Actions

- None (read-only)

### Notes

- If you want direct deep link, add `GET /questions/{id}` (optional, not required by MVP contract).

---

## 6) Student Library (list + filters + search)

### Data needed

- Published library entries list:
  - title, categoryId, preview (optional), updatedAt
- Category list
- Search query input

### Source

- Option A (recommended): **API** `GET /library` with:
  - `categoryId`, `q`
- Option B: **FS** query `library_entries where status == "published"`
  - - category filter `where categoryId == ...`
  - - MVP search:
    * prefix on `titleLower` OR
    * `array-contains` / `array-contains-any` on `keywords`

### Actions

- Apply category filter:
  - query param / state change only
- Search:
  - query param / state change only
- Open library entry:
  - navigation to “Library Entry View”

### Notes

- API is cleaner because Firestore “search” is limited; however FS-only approach can work with `keywords`.

---

## 7) Student Library Entry (view)

### Data needed

- Entry content:
  - title, content, videoUrl, categoryId

### Source

- Option A: **API** `GET /library/{id}`
- Option B: **FS** read `library_entries/{id}` (rules: only if published)

### Actions

- None (read-only)

---

## Admin/Expert area

## 8) Admin Dashboard

### Data needed

- Current user profile/role

### Source

- **API** `GET /me` (recommended)

### Actions

- Navigate to modules:
  - Students, Goals, Step Templates, Questions, Library, Categories

---

## 9) Admin Students (list)

### Data needed

- Students list (uid, email, displayName, status)
- Optional: assigned goalId or progress summary (nice-to-have)

### Source

- **API** `GET /admin/students`

### Actions

- Create student:
  - **API** `POST /admin/students`
- Open student profile:
  - navigation

### Notes

- If later you want quick plan/progress in list, extend API response or compute server-side.

---

## 10) Admin Student Profile (plan builder)

### Data needed

- Student profile
- Current plan (goalId)
- Goal list
- Step templates list (filterable)
- Current plan steps (ordered)
- Optional: categories for filtering templates

### Source

- Student:
  - **API** `GET /admin/students` + select item (or add `GET /admin/students/{uid}` optional)
- Plan + steps:
  - Option A (recommended): read via **FS** as staff (full access), or implement API endpoints later
  - Option B: keep admin UI fully API-driven (more work)
- Goals list:
  - **API** `GET /admin/goals` (or FS read if allowed; but admin module already uses API)
- Templates:
  - **API** `GET /admin/step-templates`
- Categories:
  - **API** `GET /admin/categories` (or FS read)

### Actions

- Assign goal / create plan:
  - **API** `POST /admin/students/{uid}/plan`
- Add steps from templates / custom:
  - **API** `POST /admin/students/{uid}/plan/steps`
- Reorder steps:
  - **API** `PATCH /admin/students/{uid}/plan/steps/reorder`
- Remove a step:
  - MVP options:
    - Option A: staff deletes step in **FS** directly
    - Option B: add API endpoint later (recommended for consistency)

### Notes

- For MVP speed: allow staff to read plan/steps directly from FS, but write operations (bulk add/reorder) through API.

---

## 11) Admin Questions (list + filters)

### Data needed

- Questions list with filters:
  - status, categoryId, studentUid, createdAt

### Source

- **API** `GET /questions` (staff mode supports filters)

### Actions

- Open question:
  - navigation to “Answer Question”
- Filter by status/category/student:
  - client state → API query params

---

## 12) Admin Answer Question

### Data needed

- Question details
- Student reference (uid/email) for context (optional)
- Categories (optional)
- Existing answer (if already answered)

### Source

- Question:
  - **API** `GET /questions` + find by id (or add optional `GET /admin/questions/{id}`)
- Categories:
  - **API** `GET /admin/categories` (optional)

### Actions

- Submit answer (+ optional publish to library):
  - **API** `POST /admin/questions/{id}/answer`

### Notes

- Publishing flow can either:
  - create a new library entry every time, or
  - upsert by `sourceQuestionId` (recommended).

---

## 13) Admin Library (list + editor)

### Data needed

- Library entries list (draft + published)
- Entry editor: categoryId, title, content, videoUrl, status, keywords

### Source

- List:
  - **API** `GET /library` with `status=draft|published` (staff)
- Single entry:
  - **API** `GET /library/{id}`

### Actions

- Create entry:
  - **API** `POST /admin/library`
- Update entry:
  - **API** `PATCH /admin/library/{id}`
- Publish/unpublish:
  - same PATCH (`status`)

---

## 14) Admin Settings (Categories / Goals / Step Templates)

### Data needed

- lists + single entity values for edit forms

### Source

- Categories:
  - **API** `GET /admin/categories`
- Goals:
  - **API** `GET /admin/goals`
- Templates:
  - **API** `GET /admin/step-templates`

### Actions

- Create/update/delete:
  - **API** CRUD routes for each entity (see `api-contract.md`)

---

## Implementation recommendation (MVP)

### Prefer Firestore direct for:

- Student dashboard: read plan/steps, toggle step done
- Student read-only content (published library)

### Prefer API for:

- Role detection `/me`
- All staff/admin operations:
  - student management
  - assigning plans
  - bulk steps creation
  - reorder steps
  - answering questions
  - publishing to library
- Library search endpoint (to hide Firestore search limitations)

---

## Optional endpoints to simplify UI (not required but helpful)

If you decide to add these, they reduce client complexity:

- `GET /admin/students/{uid}` (single student profile)
- `GET /questions/{id}` (student) and/or `GET /admin/questions/{id}` (staff)
- `DELETE /admin/students/{uid}/plan/steps/{stepId}` (step removal via API)
