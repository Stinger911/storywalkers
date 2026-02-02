# Firestore Rules Logic (MVP) — Personalized Learning Pathways

This document describes **authorization and access logic** for Firestore in the MVP.
It is intentionally written as “policy + constraints” (not the rules syntax), so it can be used as a checklist
when implementing `firestore.rules`.

## Roles

Roles are stored in `users/{uid}.role`:

- `student`
- `admin`
- `expert`

For MVP, the rules treat `admin` and `expert` as “staff”.

### Definitions

- **Authenticated user**: request has `auth.uid`.
- **Self document**: doc id equals `auth.uid`.
- **Staff**: user role is `admin` OR `expert`.

---

## Global principles

1. **Deny-by-default**

   - Any collection not listed below is not accessible.

2. **Students are strictly sandboxed**

   - A student can read/write only their own plan/steps and own questions.
   - A student can read only published library entries.

3. **Staff can manage everything**

   - Staff can read/write all documents in all MVP collections.

4. **Students cannot elevate privilege**

   - Students cannot write their own `users/{uid}.role` or set themselves to staff.

5. **Server timestamps**
   - Where possible, enforce `createdAt/updatedAt` as server timestamps via backend (preferred).
   - If client writes are allowed (steps toggle), allow only safe fields.

---

## Collection policies

## 1) `users/{uid}`

### Student access

- Read: ✅ only `users/{auth.uid}`
- Write: ⚠️ limited / preferably via backend
  - Student may update only:
    - `displayName` (optional)
  - Student may NOT update:
    - `role`
    - `status`
    - `email` (optional rule: allow if equals auth email; safer to disallow)
    - `createdAt`

### Staff access

- Read: ✅ any user doc
- Write: ✅ any user doc, including:
  - `role`, `status`, profile fields

### Anti-abuse constraints

- Any write by non-staff must ensure:
  - `resource.id == auth.uid`
  - `role` field is unchanged
  - `status` is unchanged

---

## 2) `categories/{categoryId}`

### Student access

- Read: ✅ allowed (used for filters)
- Write: ❌ denied

### Staff access

- Read: ✅ allowed
- Write: ✅ full CRUD

---

## 3) `goals/{goalId}`

### Student access

- Read: ✅ allowed (optional)

  - Recommended: allow read so UI can show goal title/description from `goalId`.
  - Alternative: deny and denormalize goal title into plan (not recommended).

- Write: ❌ denied

### Staff access

- Read: ✅ allowed
- Write: ✅ full CRUD

---

## 4) `step_templates/{templateId}`

### Student access

- Read: ✅ allowed (optional)

  - Recommended: allow read, or use admin API only.
  - If you allow read, consider filtering in UI by `isActive`.

- Write: ❌ denied

### Staff access

- Read: ✅ allowed
- Write: ✅ full CRUD

---

## 5) `student_plans/{uid}`

Plan document for the student.
**Document id equals student uid.**

### Student access

- Read: ✅ only `student_plans/{auth.uid}`
- Write: ❌ denied (recommended)
  - Plan creation and updates (goal assignment, etc.) are staff-only.
  - Student progress updates happen in steps subcollection only.

### Staff access

- Read: ✅ any plan
- Write: ✅ full CRUD

### Anti-abuse constraints

- For any write (if ever allowed), enforce:
  - `studentUid` must equal doc id
  - `goalId` must be a string
  - Student must not change goalId

---

## 6) `student_plans/{uid}/steps/{stepId}`

Steps are stored as a subcollection under the student plan.

### Student access

- Read: ✅ only for their own plan:

  - `student_plans/{auth.uid}/steps/*`

- Write: ✅ limited update ONLY (toggle progress)
  - Student may update only:
    - `isDone`
    - `doneAt`
    - `updatedAt` (optional)
  - Student may NOT update:
    - `title`, `description`, `materialUrl`
    - `order`
    - `templateId`
    - `createdAt`
  - Student may NOT create or delete steps.

### Staff access

- Read: ✅ full access
- Write: ✅ full access, including:
  - bulk create steps from templates
  - reorder steps (update `order`)
  - edit step content per student if needed

### Toggle constraints

When student updates step:

- `isDone` must be boolean
- `doneAt`:
  - if `isDone == true` → `doneAt` must be set (timestamp)
  - if `isDone == false` → `doneAt` must be null
- no other fields changed

---

## 7) `questions/{questionId}`

### Student access

- Read: ✅ only documents where `studentUid == auth.uid`
- Create: ✅ allowed, but only if:

  - `studentUid` equals `auth.uid`
  - `status` is `"new"`
  - `answer` is null (or absent)
  - `createdAt/updatedAt` are set (or backend sets them)

- Update: ✅ limited (optional)

  - Recommended MVP: allow student to update only their own question _before it is answered_:
    - `title`, `body`, `categoryId`, `updatedAt`
  - Deny update if:
    - `status == "answered"` OR `answer != null`

- Delete: ❌ denied (optional)
  - Safer to deny deletes; staff can moderate.

### Staff access

- Read: ✅ all questions
- Update: ✅ can answer:
  - set `status = "answered"`
  - set `answer` map
  - update `updatedAt`
- Delete: ✅ allowed (optional)

### Critical constraint

- Student must never be able to write `answer` or set `status = "answered"`.

---

## 8) `library_entries/{entryId}`

### Student access

- Read: ✅ only if `status == "published"`
- Write: ❌ denied

### Staff access

- Read: ✅ all entries (draft + published)
- Write: ✅ full CRUD

### Additional constraints

- If `sourceQuestionId` is set, it must reference an existing question (enforced by backend, not rules).
- Search fields:
  - `keywords` and `titleLower` should be generated/maintained by backend for consistency.

---

## Summary matrix (who can do what)

### Student

- `users/{uid}`: read self; limited profile write (no role/status)
- `categories`: read
- `goals`: read (recommended)
- `step_templates`: read (optional)
- `student_plans/{uid}`: read self; no write
- `student_plans/{uid}/steps`: read self; update progress only (`isDone`, `doneAt`)
- `questions`: read own; create; limited update before answered; no answer/status editing
- `library_entries`: read published only

### Staff (admin/expert)

- Full read/write on all MVP collections

---

## Implementation notes (practical)

1. Role lookup in rules

   - Rules may need to read `users/{auth.uid}` to check role.
   - This requires that authenticated users can read their own `users/{uid}` doc.

2. Prefer backend for admin operations

   - Plan assignment, bulk step creation, answering questions, publishing to library:
     do it via Python API for validation and to reduce rules complexity.

3. Keep student writes minimal

   - Only allow “toggle progress” on steps and “create question”.
   - The rest should be staff-only.

4. Testing checklist
   - Student cannot read other student plan/steps by changing uid in path.
   - Student cannot query all questions; must be filtered to own.
   - Student cannot write `answer` or set `status = answered`.
   - Student cannot reorder steps (write `order`).
   - Student cannot publish library entries.
   - Staff can read/write all collections.
