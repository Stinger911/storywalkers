---
## 5) Security model

### 5.1 Firestore Security Rules
- Students:
    - read/write only self plan/steps
    - read only own questions
    - read only published library entries
- Staff:
    - full access

### 5.2 Backend authorization
- Every request requires valid Firebase ID token.
- Backend loads user role from `users/{uid}`.
- Staff-only routes enforce `role in {admin, expert}`.

### 5.3 Principle: “thin client writes”
- Student writes are limited to “toggle step done” and “create question”.
- Everything else privileged goes via backend.
---

## 6) Non-functional requirements (MVP)

- Target load: **50–100 concurrent students**
- UI latency:
  - lists should load within ~1–2 seconds on normal connection
- Logging:
  - structured logs in backend (request id, uid, route, status)
- Error handling:
  - consistent JSON error shape (see `api-contract.md`)
- Anti-duplicates:
  - backend can implement idempotency for question creation (optional)
  - client disables submit button while request in flight (recommended)

---

## 7) CI/CD (optional MVP)

### Option A: Manual deploy (fastest)

- Frontend: `firebase deploy`
- Backend: `gcloud run deploy`

### Option B: GitHub Actions (recommended soon)

- on push to main:
  - build & deploy frontend to Firebase Hosting
  - build Docker image and deploy to Cloud Run
- store secrets in GitHub Actions / Workload Identity Federation (ideal)

---

## 8) Future extensions (v2-ready)

- Full-text search:
  - integrate Algolia/Meilisearch; keep API interface stable (`GET /library?q=...`)
- Multiple plans per student:
  - change `student_plans/{uid}` to `student_plans/{planId}` + active plan pointer
- Notifications:
  - email/push on answered questions (Cloud Tasks / PubSub)
- Analytics:
  - Firebase Analytics or backend events
