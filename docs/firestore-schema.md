# Firestore Schema (MVP) — Personalized Learning Pathways

This document defines the Firestore data model for the MVP:
**Goal → Plan → Steps**, plus **Questions/Answers** and **Library (Knowledge Base)**.

## Conventions

- All timestamps are Firestore `Timestamp` (server time), stored as:
  - `createdAt`, `updatedAt`, and optional `doneAt`.
- IDs:
  - `users/{uid}` where `uid` is Firebase Auth UID.
  - `student_plans/{uid}` where document id equals student uid (**one active plan per student**).
- Strings:
  - Prefer `camelCase` for fields.
  - Slugs should be lowercase, URL-safe.
- Roles:
  - Stored in `users/{uid}.role` for MVP (no custom claims required).
- Library search (MVP):
  - Uses `keywords` array and/or `titleLower` for prefix search.

---

## Collections overview

### 1) `users/{uid}`

User profile + role.

**Document ID:** Firebase Auth `uid`

**Fields**

- `role`: `"student" | "admin" | "expert"`
- `displayName`: `string`
- `email`: `string`
- `status`: `"disabled" | "active" | "community_only" | "expired"`
- `preferredCurrency`: `"USD" | "EUR" | "PLN"` (optional; default UI fallback is `USD`)
- `selectedGoalId`: `string | null` (optional)
- `selectedCourses`: `array<string>` (optional)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp` (optional but recommended)

**Notes**

- `email` here is a convenience cache; auth source of truth is Firebase Auth.

---

### 2) `categories/{categoryId}`

Categories for Questions and/or Library.

**Fields**

- `name`: `string`
- `slug`: `string` (lowercase, unique)
- `type`: `"questions" | "library" | "mixed"`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- `slug` used in UI routes/filters if needed.
- If you want strict separation, use two category sets; MVP can use `"mixed"`.

---

### 3) `goals/{goalId}`

Learning goals admins can assign to students.

**Fields**

- `title`: `string`
- `description`: `string` (optional)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

---

### 4) `goals/{goalId}/template_steps/{templateStepId}`

Goal-specific template steps (ordered, used to seed student plans).

**Fields**

- `title`: `string`
- `description`: `string`
- `materialUrl`: `string` (URL)
- `order`: `number` (integer, 0..N; used for sorting)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- Stored as a subcollection under the goal for versioned templates.
- Ordering is based on `order ASC`.

---

### 5) `step_templates/{templateId}`

Reusable templates for plan steps.

**Fields**

- `title`: `string`
- `description`: `string`
- `materialUrl`: `string` (URL)
- `categoryId`: `string | null` (ref-like id, no actual Firestore ref required)
- `tags`: `array<string>` (optional)
- `isActive`: `boolean` (default: `true`)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- `categoryId` must point to `categories/{categoryId}` (logical FK).
- `tags` can be used for filtering templates in admin UI.

---

## Student plan model (core)

### 6) `student_plans/{uid}`

Plan assigned to a specific student.

**Document ID:** student `uid` (enforced for MVP)

**Fields**

- `studentUid`: `string` (must equal doc id; kept for queries/debug)
- `goalId`: `string` (logical FK to `goals/{goalId}`)
- `lastResetAt`: `timestamp | null` (optional)
- `lastResetBy`: `string | null` (optional, staff uid)
- `sourceGoalTemplateVersion`: `string | number | null` (optional)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- This makes reads easy: student always loads `student_plans/{auth.uid}`.
- One active plan per student (v2 could introduce multiple plans).

---

### 7) `student_plans/{uid}/steps/{stepId}`

Individual steps inside a student plan (copied from templates, but can be customized).

**Fields**

- `templateId`: `string | null`
- `title`: `string`
- `description`: `string`
- `materialUrl`: `string`
- `order`: `number` (integer, 0..N; used for sorting)
- `isDone`: `boolean`
- `doneAt`: `timestamp | null`
- `doneComment`: `string | null`
- `doneLink`: `string | null`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- Even if step is created from template, we still store full content to allow edits per student.
- Reordering is done by updating `order` fields.
- `templateId` is nullable to support custom steps.

**Sorting**

- Default order: `order ASC`.

---

### 8) `step_completions/{completionId}`

Admin feed of student step completions with denormalized snapshots for quick staff review.

**Fields**

- `studentUid`: `string`
- `studentDisplayName`: `string | null` (snapshot)
- `goalId`: `string | null` (snapshot)
- `goalTitle`: `string | null` (snapshot)
- `stepId`: `string`
- `stepTitle`: `string | null` (snapshot)
- `completedAt`: `timestamp`
- `comment`: `string | null`
- `link`: `string | null`
- `status`: `"completed" | "revoked"`
- `revokedAt`: `timestamp | null`
- `revokedBy`: `string | null`
- `updatedAt`: `timestamp`

**Notes**

- Feed entries are immutable history records except admin moderation fields (`comment`, `link`, revoke metadata).
- Keep `completedAt` as the main sort field for admin feed queries.

---

## Q&A

### 9) `questions/{questionId}`

Student questions with expert answers. Students can only access their own.

**Fields**

- `studentUid`: `string`
- `categoryId`: `string` (logical FK to `categories/{categoryId}`)
- `title`: `string`
- `body`: `string` (optional)
- `status`: `"new" | "answered"` (MVP)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`
- `answer`: `map | null`
  - `expertUid`: `string`
  - `text`: `string`
  - `videoUrl`: `string | null`
  - `createdAt`: `timestamp`
  - `publishToLibrary`: `boolean` (MVP uses this as a flag)

**Notes**

- When answering, update:
  - `status = "answered"`
  - `answer.*`
  - `updatedAt`
- Students should never be able to write `answer`.

---

## Library / Knowledge Base

### 10) `library_entries/{entryId}`

Published knowledge base entries, optionally derived from a question.

**Fields**

- `categoryId`: `string` (logical FK)
- `title`: `string`
- `titleLower`: `string` (optional, recommended for prefix search)
- `content`: `string` (plain text or markdown-lite)
- `videoUrl`: `string | null`
- `sourceQuestionId`: `string | null`
- `status`: `"draft" | "published"`
- `keywords`: `array<string>` (optional; used for MVP search)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- Students can read only `status == "published"`.
- For MVP search:
  - `keywords` should be generated server-side:
    - tokenize title (and optionally content headings),
    - lowercase,
    - remove very short words,
    - deduplicate.

---

## Courses / Lessons / FX

### 11) `courses/{courseId}`

Catalog of paid courses for onboarding/checkout.

**Fields**

- `title`: `string`
- `description`: `string` (optional)
- `goalIds`: `array<string>` (course can belong to many goals)
- `priceUsdCents`: `int` (USD cents; source of truth)
- `isActive`: `bool`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- UI conversion to selected currency must use FX endpoint and keep USD cents as canonical value.
- Inactive courses can be hidden or marked unavailable in UI.

### 12) `courses/{courseId}/lessons/{lessonId}`

Lesson content for a course.

**Fields**

- `title`: `string`
- `type`: `"video" | "text" | "task"`
- `content`: `string`
- `order`: `int` (for sorting)
- `isActive`: `bool`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Access rule**

- Read allowed only for `users/{uid}.status == "active"` students (staff always allowed).

### 13) `fx_rates/latest`

Latest FX snapshot used by frontend price conversion.

**Fields**

- `base`: `string` (usually `USD`)
- `rates`: `map<string, number>` (example: `{ USD: 1, EUR: 0.92, RUB: 92.4 }`)
- `updatedAt`: `timestamp`

---

## Recommended indexes (Firestore composite)

Create these if Firestore asks, or proactively:

### Questions (admin filters)

1. `questions`: `status ASC, categoryId ASC, createdAt DESC`
2. `questions`: `studentUid ASC, createdAt DESC` (student list)

### Library (filters + search)

3. `library_entries`: `status ASC, categoryId ASC, title ASC`
4. If using prefix search with `titleLower`:
   - `library_entries`: `status ASC, categoryId ASC, titleLower ASC`

### Student steps ordering

5. Subcollection `student_plans/{uid}/steps`: single-field index on `order` usually works; if Firestore requires composite for additional filters, add as needed.

### Step completions feed

6. `step_completions`: index/query on `completedAt DESC` for admin feed.

### Courses and lessons

7. `courses`: composite index for active catalog listing/filtering, e.g. `isActive ASC, title ASC`.
8. `courses/{courseId}/lessons`: index for ordered active lessons, e.g. `isActive ASC, order ASC`.

---

## Minimal sample documents

### `users/{uid}`

```json
{
  "role": "student",
  "displayName": "Alex",
  "email": "alex@example.com",
  "status": "active",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `student_plans/{uid}`

```json
{
  "studentUid": "UID123",
  "goalId": "goal_video_editor",
  "lastResetAt": "timestamp",
  "lastResetBy": "admin_uid_1",
  "sourceGoalTemplateVersion": "v2",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `goals/{goalId}/template_steps/{templateStepId}`

```json
{
  "title": "Edit interview b-roll",
  "description": "Practice cutting b-roll to cover jump cuts",
  "materialUrl": "https://...",
  "order": 0,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `student_plans/{uid}/steps/{stepId}`

```json
{
  "templateId": "tmpl_cut_basics",
  "title": "Learn basic cuts",
  "description": "Watch lesson and practice on a short clip",
  "materialUrl": "https://...",
  "order": 0,
  "isDone": false,
  "doneAt": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `questions/{questionId}`

```json
{
  "studentUid": "UID123",
  "categoryId": "cat_editing",
  "title": "How do I remove background noise?",
  "body": "I have a voiceover with hum...",
  "status": "new",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "answer": null
}
```

### `library_entries/{entryId}`

```json
{
  "categoryId": "cat_audio",
  "title": "Remove background noise in DaVinci Resolve",
  "titleLower": "remove background noise in davinci resolve",
  "content": "Steps: ...",
  "videoUrl": "https://...",
  "sourceQuestionId": "q_abc123",
  "status": "published",
  "keywords": ["remove", "background", "noise", "davinci", "resolve", "audio"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```
