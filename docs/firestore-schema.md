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
- `status`: `"active" | "disabled"`
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

### 4) `step_templates/{templateId}`

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

### 5) `student_plans/{uid}`

Plan assigned to a specific student.

**Document ID:** student `uid` (enforced for MVP)

**Fields**

- `studentUid`: `string` (must equal doc id; kept for queries/debug)
- `goalId`: `string` (logical FK to `goals/{goalId}`)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- This makes reads easy: student always loads `student_plans/{auth.uid}`.
- One active plan per student (v2 could introduce multiple plans).

---

### 6) `student_plans/{uid}/steps/{stepId}`

Individual steps inside a student plan (copied from templates, but can be customized).

**Fields**

- `templateId`: `string | null`
- `title`: `string`
- `description`: `string`
- `materialUrl`: `string`
- `order`: `number` (integer, 0..N; used for sorting)
- `isDone`: `boolean`
- `doneAt`: `timestamp | null`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

**Notes**

- Even if step is created from template, we still store full content to allow edits per student.
- Reordering is done by updating `order` fields.
- `templateId` is nullable to support custom steps.

**Sorting**

- Default order: `order ASC`.

---

## Q&A

### 7) `questions/{questionId}`

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

### 8) `library_entries/{entryId}`

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
