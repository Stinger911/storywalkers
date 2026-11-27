# Changelog

All notable changes to StoryWalkers. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions match the git
tags.

## [Unreleased]

### Upgrade notes

- Deploy the Firestore rules, and check that they are applied to the databases
  the backend uses (`testing`, `pathways`): the `firestore` section of the
  Firebase configs does not name a database.
- Run `backend/scripts/block_staff_disabled_students.py --env <dev|prod>` to
  review students disabled before `accessBlocked` existed, then repeat with
  `--apply`.
- The public funnel needs an active goal with the slug `youtube`.
- `YOUTUBE_API_KEY` is optional; without it students type channel numbers by
  hand.
- Frontend tooling needs Node.js 22.12 or newer.
- `backend/requirements.txt`, which the Docker image installs from, was not
  regenerated after the dependency pin bump in `backend/pyproject.toml`.

### Added

- Pre-registration funnel under `/start`: channel, topic and format, goal, and a
  learning plan with course and single-lesson selection and prices. Answers are
  saved to the account after sign-in.
- Public endpoints for the funnel: YouTube channel lookup and the learning path
  preview.
- Expert track for students who already have a channel: waiting screen, student
  filter and badge, Telegram notification, and invoices issued by staff.
- Sale of individual lessons in onboarding and in student courses.
- Admin CRM: contacts, feedback log, next-ping dates, a card in the student
  profile, and an import script for the spreadsheet.
- Referral links with registration monitoring.
- Access expiry through `activeTo`.
- Access block (`accessBlocked`): a blocked student cannot regain access through
  checkout or a payment email. It follows status changes made by staff and has a
  checkbox in the student profile.
- Admin: read-only preview of a student dashboard, Telegram handle editing, goal
  slug editing, course tags, single-choice intake questions, questionnaire badge
  and total page counts in the student list.
- Student: the current-step card opens the step details.
- Onboarding design system and Figma reference frames in `design/`.
- Onboarding quote card with four quotes that rotate automatically and can be
  switched by swipe, dots or arrow keys.

### Changed

- New design for onboarding, sign-in, blocked, profile, expert and payment
  screens, with self-hosted fonts.
- A free "first hundred" checkout activates access at once. The payment page then
  links to the dashboard and keeps the Boosty link for the community payment.
- The "first hundred" limit counts active students only.
- Signing in after the funnel continues to payment or to the expert screen.
- Onboarding requires a Telegram handle and a goal.
- Personalized onboarding and course dashboard; refined student path layout.
- Fewer Firestore reads in the backend and lower request pressure from the
  student sheet sync.
- Icons are inline SVG instead of an icon font.
- Dependency updates: npm security fixes, Vitest 5, backend pins; CI runs on
  Node.js 22.

### Fixed

- Lessons are ordered by their order in the course, not by purchase order.
- First-hundred students can complete checkout; lesson prices are hidden for
  them.
- The plan step keeps the selection without reloading on every change, and long
  course names no longer overlap the lesson counter.
- Checkout shows lesson titles after a full page load.
- Intake question inputs keep focus while typing.

### Removed

- The old goal and course selection pages (`/onboarding/goal`,
  `/onboarding/courses` now redirect to `/start`). Goal intake questions are no
  longer collected during onboarding.

### Security

- Hardened application security: hosting security headers, tighter logging and
  webhook checks.
- Staff decisions to block access are enforced on automatic activation.
- Firestore rules: only staff and the backend create user profiles.

## [1.0.0] - 2026-04-28

### Added

- "First hundred" badge in the admin student list.

### Changed

- Onboarding profile submission is tracked explicitly.
- Cleaned up Firestore rules warnings.

### Fixed

- Community-only checkout in onboarding.
- Onboarding stays compatible with an older backend, including a fallback for the
  course list.
- The legacy onboarding notes field is no longer sent.

## [0.9.0] - 2026-04-26

### Added

- Student onboarding: profile, courses and checkout with guards and
  localization.
- Courses and lessons in the admin panel; purchased course lessons are added to
  student plans.
- Payments: checkout intents, activation from Gmail and Boosty emails, admin
  payment pages.
- Telegram messaging and webhook.
- Learning path visualization, embedded YouTube lessons and Markdown lesson
  descriptions.
- Automatic "first hundred" marking.
- Admin student filters, sorting and pagination; soft-deleted goals; confirmation
  dialogs for deletion.
- Password recovery on the sign-in page.

### Changed

- Redesigned student experience; progress bar, lesson counters, locked and
  loading states.
- Role and status route guards with a blocked screen.
- Production Firebase configuration and deployment scripts.

### Security

- Restricted client access to payments and settings in Firestore.

## [0.3.5] - 2026-02-12

Tags `v0.3.3`, `v0.3.4` and `v0.3.5` point to the same commit; `v0.3.1` and
`v0.3.2` are included here.

### Changed

- Release workflow deploys to Firebase and Cloud Run with Workload Identity
  Federation; the Firestore database is selected by environment.

## [0.3.0] - 2026-02-12

### Added

- Localized student pages and display name editing.
- Student profile reset with preview, plan step deletion and guarded student
  deletion.
- Moderation of step completions with a status filter.

### Changed

- Separate student and staff lists in the admin panel.
- Fewer Firestore reads and query timing in the backend.

## [0.2.0] - 2026-02-04

### Added

- First version: SolidJS frontend, FastAPI backend, Firebase Auth and Firestore
  rules.
- Admin management of students, library and questions.
- Deployment on tags through GitHub Actions.
