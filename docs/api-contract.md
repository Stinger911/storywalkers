````md
# API Contract (MVP) — Personalized Learning Pathways

Backend: **Python (FastAPI)** deployed on **Cloud Run**.  
Auth: **Firebase Authentication** (ID token in `Authorization` header).  
This contract defines the minimal API surface for the MVP.

Source: project specification :contentReference[oaicite:0]{index=0}

---

## 0) Conventions

### Base URL

- `https://<cloud-run-service>/api` (recommended)
- All routes below are relative to `/api`

### Auth header

All requests require:

- `Authorization: Bearer <FIREBASE_ID_TOKEN>`

### Roles

Role is stored in Firestore `users/{uid}.role`:

- `student`
- `admin`
- `expert`

Backend treats `admin` and `expert` as **staff**.

### Content-Type

- Requests with body: `Content-Type: application/json`

### Errors (standard)

Backend returns JSON errors in shape:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```
````

Recommended HTTP status codes:

- `400` validation error
- `401` unauthenticated / missing token
- `403` forbidden / insufficient role
- `404` not found
- `409` conflict (duplicate / invalid state)
- `429` rate limit (optional)
- `500` server error

### Timestamps

All timestamps are RFC3339 strings in API:

- `"2026-02-02T10:15:30Z"`

---

## 1) Auth / Me

### GET `/me`

Returns current user profile and role.

**Access:** any authenticated user

**Response 200**

```json
{
  "uid": "UID123",
  "email": "alex@example.com",
  "displayName": "Alex",
  "role": "student",
  "status": "active"
}
```

---

### PATCH `/me`

Update current user profile (MVP: display name only).

**Access:** any authenticated user

**Request**

```json
{
  "displayName": "Alex Doe"
}
```

**Response 200**

```json
{
  "uid": "UID123",
  "email": "alex@example.com",
  "displayName": "Alex Doe",
  "role": "student",
  "status": "active"
}
```

**Notes**

- Only `displayName` is accepted; any other fields are rejected.
- `displayName` must be 1..60 chars after trimming.

---

## 2) Admin: Students

> Staff-only routes.

### GET `/admin/students`

List students (and optionally staff, depending on implementation).

**Access:** staff

**Query params (optional)**

- `status`: `active|disabled`
- `role`: `student|admin|expert|staff` (default: `student`)
- `q`: string (search by email/displayName; MVP can ignore or simple contains)
- `limit`: number (default 50, max 200)
- `cursor`: string (pagination token; optional MVP)

**Response 200**

```json
{
  "items": [
    {
      "uid": "UID123",
      "email": "alex@example.com",
      "displayName": "Alex",
      "role": "student",
      "status": "active",
      "progressPercent": 40,
      "stepsDone": 2,
      "stepsTotal": 5,
      "createdAt": "2026-02-02T10:15:30Z"
    }
  ],
  "nextCursor": null
}
```

---

### POST `/admin/students`

Create a student user record (MVP: create Firestore profile; optional invite flow).

**Access:** staff

**Request**

```json
{
  "email": "alex@example.com",
  "displayName": "Alex",
  "role": "student"
}
```

**Response 201**

```json
{
  "uid": "UID123",
  "email": "alex@example.com",
  "displayName": "Alex",
  "role": "student",
  "status": "active",
  "createdAt": "2026-02-02T10:15:30Z"
}
```

**Notes**

- Implementation options:

  1. create only Firestore doc and rely on user self-signup with same email
  2. create Auth user via Admin SDK (requires privileged backend)

- MVP allowed to do (1) if you have controlled onboarding.

---

### PATCH `/admin/students/{uid}`

Update student profile/status.

**Access:** staff

**Request (any subset)**

```json
{
  "displayName": "Alex Doe",
  "status": "disabled",
  "role": "expert"
}
```

**Response 200**

```json
{
  "uid": "UID123",
  "email": "alex@example.com",
  "displayName": "Alex Doe",
  "role": "student",
  "status": "disabled",
  "progressPercent": 40,
  "stepsDone": 2,
  "stepsTotal": 5,
  "updatedAt": "2026-02-02T11:00:00Z"
}
```

---

### POST `/admin/students/{uid}/plan`

Assign (or replace) student goal and ensure a plan exists.

**Access:** staff

**Request**

```json
{
  "goalId": "goal_video_editor"
}
```

**Response 200**

```json
{
  "planId": "UID123",
  "studentUid": "UID123",
  "goalId": "goal_video_editor",
  "createdAt": "2026-02-02T10:15:30Z",
  "updatedAt": "2026-02-02T11:05:00Z"
}
```

**Notes**

- In Firestore: `student_plans/{uid}` doc id MUST equal `{uid}`.

---

### POST `/admin/students/{uid}/plan/steps`

Bulk add steps to a student plan from templates and/or custom steps.

**Access:** staff

**Request**

```json
{
  "items": [
    { "templateId": "tmpl_cut_basics" },
    {
      "title": "Custom step title",
      "description": "Custom step description",
      "materialUrl": "https://...",
      "templateId": null
    }
  ],
  "append": true
}
```

**Rules**

- If `templateId` is provided:

  - backend copies template fields into student step
  - sets `templateId` on created step

- If custom step provided:

  - `title`, `description`, `materialUrl` required

- `append=true` means add to end with next `order` values.
- If `append=false`, backend may replace existing steps (optional; if implemented, document clearly).

**Response 201**

```json
{
  "created": [
    {
      "stepId": "step_001",
      "order": 0,
      "templateId": "tmpl_cut_basics",
      "title": "Learn basic cuts",
      "description": "Watch lesson and practice on a short clip",
      "materialUrl": "https://...",
      "isDone": false,
      "doneAt": null
    }
  ]
}
```

---

### PATCH `/admin/students/{uid}/plan/steps/reorder`

Reorder steps by updating `order` fields.

**Access:** staff

**Request**

```json
{
  "items": [
    { "stepId": "step_001", "order": 0 },
    { "stepId": "step_002", "order": 1 }
  ]
}
```

**Response 200**

```json
{
  "updated": 2
}
```

---

## 3) Admin: Settings (Categories / Goals / Step Templates)

> Staff-only CRUD. All list endpoints support `limit` and optional simple pagination.

### Categories

#### GET `/admin/categories`

**Access:** staff

**Response 200**

```json
{
  "items": [
    {
      "id": "cat_editing",
      "name": "Editing",
      "slug": "editing",
      "type": "mixed"
    }
  ]
}
```

#### POST `/admin/categories`

**Request**

```json
{ "name": "Editing", "slug": "editing", "type": "mixed" }
```

**Response 201**

```json
{ "id": "cat_editing", "name": "Editing", "slug": "editing", "type": "mixed" }
```

#### PATCH `/admin/categories/{id}`

**Request**

```json
{ "name": "Video Editing" }
```

#### DELETE `/admin/categories/{id}`

**Response 204** (no body)

---

### Goals

#### GET `/admin/goals`

**Response 200**

```json
{
  "items": [
    {
      "id": "goal_video_editor",
      "title": "Become a video editor",
      "description": "..."
    }
  ]
}
```

#### POST `/admin/goals`

**Request**

```json
{ "title": "Become a video editor", "description": "..." }
```

**Response 201**

```json
{
  "id": "goal_video_editor",
  "title": "Become a video editor",
  "description": "..."
}
```

#### PATCH `/admin/goals/{id}`

#### DELETE `/admin/goals/{id}`

---

### Step Templates

#### GET `/admin/step-templates`

**Query params (optional)**

- `isActive`: `true|false`
- `categoryId`: string

**Response 200**

```json
{
  "items": [
    {
      "id": "tmpl_cut_basics",
      "title": "Learn basic cuts",
      "description": "Watch lesson and practice",
      "materialUrl": "https://...",
      "categoryId": "cat_editing",
      "tags": ["cuts", "basics"],
      "isActive": true
    }
  ]
}
```

#### POST `/admin/step-templates`

**Request**

```json
{
  "title": "Learn basic cuts",
  "description": "Watch lesson and practice",
  "materialUrl": "https://...",
  "categoryId": "cat_editing",
  "tags": ["cuts", "basics"],
  "isActive": true
}
```

**Response 201**

```json
{
  "id": "tmpl_cut_basics",
  "title": "Learn basic cuts",
  "description": "Watch lesson and practice",
  "materialUrl": "https://...",
  "categoryId": "cat_editing",
  "tags": ["cuts", "basics"],
  "isActive": true
}
```

#### PATCH `/admin/step-templates/{id}`

#### DELETE `/admin/step-templates/{id}`

---

## 4) Questions (Student + Admin)

### POST `/questions`

Create a question (student).

**Access:** student (or any non-staff user)

**Request**

```json
{
  "categoryId": "cat_editing",
  "title": "How do I remove background noise?",
  "body": "I have a voiceover with hum..."
}
```

**Response 201**

```json
{
  "id": "q_abc123",
  "studentUid": "UID123",
  "categoryId": "cat_editing",
  "title": "How do I remove background noise?",
  "body": "I have a voiceover with hum...",
  "status": "new",
  "createdAt": "2026-02-02T12:00:00Z",
  "updatedAt": "2026-02-02T12:00:00Z",
  "answer": null
}
```

---

### GET `/questions`

List questions.

- Students: only own questions
- Staff: all questions with filters

**Access:** any authenticated user

**Query params (optional)**

- `status`: `new|answered`
- `categoryId`: string
- `studentUid`: string (staff only)
- `limit`: number (default 50)
- `cursor`: string (optional)

**Response 200**

```json
{
  "items": [
    {
      "id": "q_abc123",
      "studentUid": "UID123",
      "categoryId": "cat_editing",
      "title": "How do I remove background noise?",
      "status": "answered",
      "createdAt": "2026-02-02T12:00:00Z",
      "updatedAt": "2026-02-02T13:00:00Z",
      "answer": {
        "expertUid": "UID999",
        "text": "Use noise reduction...",
        "videoUrl": "https://...",
        "createdAt": "2026-02-02T13:00:00Z",
        "publishToLibrary": true
      }
    }
  ],
  "nextCursor": null
}
```

---

### POST `/admin/questions/{id}/answer`

Answer a question and optionally publish to library.

**Access:** staff

**Request**

```json
{
  "text": "Use noise reduction...",
  "videoUrl": "https://...",
  "publishToLibrary": true,
  "library": {
    "status": "published",
    "categoryId": "cat_audio",
    "title": "Remove background noise in DaVinci Resolve",
    "content": "Steps: ...",
    "keywords": ["remove", "background", "noise", "davinci", "resolve"]
  }
}
```

**Behavior**

- Updates `questions/{id}`:

  - `status = "answered"`
  - sets `answer` map with `expertUid`, `text`, `videoUrl`, `createdAt`, `publishToLibrary`

- If `publishToLibrary == true`:

  - creates or updates `library_entries`:

    - `sourceQuestionId = id`
    - generates/normalizes `keywords` and `titleLower` if missing

**Response 200**

```json
{
  "question": {
    "id": "q_abc123",
    "status": "answered",
    "updatedAt": "2026-02-02T13:00:00Z"
  },
  "libraryEntry": {
    "id": "kb_001",
    "status": "published"
  }
}
```

---

## 5) Library (Student + Admin)

### GET `/library`

List published library entries for students; staff may optionally view all with filters.

**Access:** any authenticated user

**Query params (optional)**

- `categoryId`: string
- `q`: string (search; MVP can implement either):

  - prefix search on `titleLower`
  - keywords search using `keywords` array

- `status`: `draft|published` (staff only)
- `limit`: number (default 50)
- `cursor`: string (optional)

**Response 200**

```json
{
  "items": [
    {
      "id": "kb_001",
      "categoryId": "cat_audio",
      "title": "Remove background noise in DaVinci Resolve",
      "status": "published",
      "updatedAt": "2026-02-02T13:00:00Z"
    }
  ],
  "nextCursor": null
}
```

---

### GET `/library/{id}`

Get a library entry.

**Access:**

- student: only if `status == published`
- staff: any

**Response 200**

```json
{
  "id": "kb_001",
  "categoryId": "cat_audio",
  "title": "Remove background noise in DaVinci Resolve",
  "content": "Steps: ...",
  "videoUrl": "https://...",
  "status": "published",
  "keywords": ["remove", "background", "noise", "davinci", "resolve"],
  "sourceQuestionId": "q_abc123",
  "createdAt": "2026-02-02T13:00:00Z",
  "updatedAt": "2026-02-02T13:00:00Z"
}
```

---

### POST `/admin/library`

Create a library entry (manual, staff).

**Access:** staff

**Request**

```json
{
  "categoryId": "cat_audio",
  "title": "Remove background noise in DaVinci Resolve",
  "content": "Steps: ...",
  "videoUrl": "https://...",
  "status": "draft",
  "keywords": ["remove", "noise"]
}
```

**Response 201**

```json
{
  "id": "kb_002",
  "categoryId": "cat_audio",
  "title": "Remove background noise in DaVinci Resolve",
  "status": "draft",
  "createdAt": "2026-02-02T14:00:00Z",
  "updatedAt": "2026-02-02T14:00:00Z"
}
```

---

### PATCH `/admin/library/{id}`

Update a library entry (staff).

**Access:** staff

**Request (any subset)**

```json
{
  "title": "Remove background noise (Resolve)",
  "content": "Updated steps...",
  "status": "published"
}
```

**Response 200**

```json
{
  "id": "kb_002",
  "status": "published",
  "updatedAt": "2026-02-02T14:30:00Z"
}
```

---

## 6) Non-API reads/writes (allowed directly from Firestore)

To minimize backend scope, the following are allowed directly from Firestore with strict security rules:

### Student

- Read:

  - `student_plans/{uid}` (self)
  - `student_plans/{uid}/steps/*` (self)
  - `questions` (only own)
  - `library_entries` (published)

- Write:

  - `student_plans/{uid}/steps/{stepId}`: toggle `isDone`, set/clear `doneAt`
  - `questions`: create (and optionally edit before answered)

### Staff

- Prefer using backend for:

  - creating users
  - assigning plans
  - bulk creating steps
  - answering questions
  - publishing to library

---

## 7) Acceptance mapping (API coverage)

- Admin creates goals/templates/categories: ✅ `/admin/*`
- Admin assigns goal and builds plan: ✅ `/admin/students/{uid}/plan` + `/plan/steps`
- Student asks a question: ✅ `POST /questions`
- Admin answers and publishes to library: ✅ `POST /admin/questions/{id}/answer`
- Student reads library and searches: ✅ `GET /library` + `GET /library/{id}`
