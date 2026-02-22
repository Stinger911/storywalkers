# QA Telegram Smoke Checklist

This checklist validates Telegram side effects without relying on real Telegram delivery.

## Preconditions

- Backend is running.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` are configured for environments where real sends are expected.
- Use a staff-authenticated session for admin endpoints.

## 1) Registration Event (`POST /api/admin/students`)

1. Create a new student using `POST /api/admin/students` with an email that does not already exist.
2. Confirm response is `201`.
3. Verify one registration Telegram event is emitted with user identity fields (`uid`, `email`, `status`, `role`).
4. Re-run with same auth UID/email mapping and confirm no additional registration event for non-new user creation path.

## 2) Questionnaire Completion Transition (`PATCH /api/me`)

1. Start from a user whose onboarding is before course selection (goal selected, profile incomplete, no selected courses).
2. Call `PATCH /api/me` with profile payload that makes questionnaire/profile complete (for example `experienceLevel`).
3. Confirm response is `200` and one questionnaire-completed Telegram event is emitted.
4. Confirm `users/{uid}.telegramEvents.questionnaireCompletedAt` is set server-side.
5. Call `PATCH /api/me` again; confirm no second questionnaire-completed event (idempotent behavior).

## 3) Status Change Event (`PATCH /api/admin/students/{uid}`)

1. Patch a student status to a different value (for example `active -> expired`).
2. Confirm response is `200`.
3. Verify one status-changed Telegram event is emitted with `old_status`, `new_status`, and `actor_uid`.
4. Patch to the same status value and confirm no Telegram status event is emitted.

## 4) Lesson Completion Active-Only Event (`POST /api/student/steps/{stepId}/complete`)

1. For an `active` student, complete a step with `POST /api/student/steps/{stepId}/complete`.
2. Confirm response is `201` and one lesson-completed Telegram event is emitted with `stepId` and step title.
3. For a non-active student (`disabled`, `expired`, or `community_only`), call the same endpoint.
4. Confirm response is `403` with standard error shape (`error.code=status_blocked`) and confirm no Telegram event is emitted.

