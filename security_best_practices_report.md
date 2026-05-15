# Security Best Practices Review

Date: 2026-05-15

Scope: FastAPI backend, Solid/Vite frontend, Firebase Hosting/Firestore configuration that affects frontend/backend security.

## Executive Summary

The application has good baseline access-control structure: backend routes generally use Firebase bearer authentication, staff-only dependencies protect admin mutation paths, direct Firestore rules default-deny, and local secret files are ignored. The first remediation pass fixed the highest-priority operational issues found in the review: auth token logging, vulnerable dependency trees, fail-open Telegram webhook authentication, public production API docs, missing Firebase Hosting security headers, and profile request-body validation logging.

Current dependency audit status:

- `npm audit --omit=dev --json` in `frontend`: 0 vulnerabilities.
- `uv tool run pip-audit -r requirements.txt --format json` in `backend`: 0 known vulnerabilities.

Open hardening items remain around markdown rendering, persisted outbound URL validation, and host-header validation.

## Critical

### SEC-001: Frontend production dependency tree includes a critical `protobufjs` advisory

- Status: Fixed. `firebase` and the lockfile now resolve patched `protobufjs`, and production `npm audit` reports 0 vulnerabilities.
- Rule ID: JS-CONFIG-DEPENDENCY-AUDIT
- Severity: Critical
- Location: `frontend/package.json:13-24`, `frontend/package-lock.json` transitive dependency tree
- Evidence: `npm audit --omit=dev --json` reported `protobufjs <=7.5.5` with critical advisory `GHSA-xq3m-2v4x-88gg` and additional high/moderate protobufjs advisories. The direct app dependency set includes Firebase at `frontend/package.json:20`, which pulls protobuf-related packages.
- Impact: A vulnerable client/build dependency with arbitrary code execution advisories increases supply-chain and build/runtime risk, depending on where the affected package is executed.
- Fix: Update the frontend lockfile with patched transitive versions. Start with `npm update protobufjs @protobufjs/utf8 firebase`, then rerun `npm audit --omit=dev`. If npm cannot resolve a patched tree under current constraints, evaluate upgrading the direct package that pulls it.
- Mitigation: Keep this in CI as a failing production dependency audit and pin lockfile updates through review.
- False positive notes: Verify exact reachability in the bundled app; audit still needs remediation because the package is present in the production dependency tree.

## High

### SEC-002: Backend logs bearer auth tokens and decoded token payloads

- Status: Fixed. Auth logging now avoids raw bearer tokens and decoded payloads, with regression coverage.
- Rule ID: FASTAPI-AUTH-LOGGING-001
- Severity: High
- Location: `backend/app/auth/deps.py:get_current_user:174-191`
- Evidence:
  - `logger.warning(f"Verifying auth token {token}")`
  - `logger.warning(f"Fetching user profile for uid {uid} from Firestore {decoded}")`
- Impact: Anyone with access to application logs can recover Firebase ID tokens during their lifetime and impersonate users; decoded payload logging can also expose personal identifiers.
- Fix: Remove the raw token and decoded payload from logs. Log only non-sensitive metadata such as `uid`, request ID, and verification success/failure.
- Mitigation: Rotate/expire any exposed tokens by forcing Firebase clients to refresh, restrict log access, and set retention appropriately.
- False positive notes: This is a direct finding; the token string is logged before verification.

### SEC-003: Backend ASGI server dependency has unauthenticated DoS advisories

- Status: Fixed. `granian` is upgraded to `2.7.4`, and backend dependency audit reports no known vulnerabilities.
- Rule ID: FASTAPI-DEPLOY-DEPENDENCY-AUDIT
- Severity: High
- Location: `backend/pyproject.toml:15`, `backend/Dockerfile:15`
- Evidence: `granian==2.6.1` is pinned and used as the production server. `pip-audit` reported `CVE-2026-42544` and `CVE-2026-42545`, fixed in `granian 2.7.4`; one advisory is an unauthenticated WebSocket upgrade worker crash.
- Impact: A crafted request can terminate workers before the ASGI app handles the request, creating remote denial-of-service risk.
- Fix: Upgrade `granian` to `>=2.7.4`, rebuild the image, and rerun backend tests plus `pip-audit`.
- Mitigation: If upgrade cannot happen immediately, block unexpected WebSocket upgrade requests at the edge.
- False positive notes: The app itself does not define WebSockets, but the advisory is in the server request handling path.

### SEC-004: Telegram webhook authentication is optional

- Status: Fixed in app code. Non-local environments now fail closed when `TELEGRAM_WEBHOOK_SECRET` is missing; the runtime secret still needs to be configured in production.
- Rule ID: FASTAPI-WEBHOOK-AUTH-001
- Severity: High
- Location: `backend/app/routers/telegram_webhook.py:57-68`, `backend/cloudrun.yaml:18-24`
- Evidence: The route only validates `X-Telegram-Bot-Api-Secret-Token` when `TELEGRAM_WEBHOOK_SECRET` is configured. The checked Cloud Run env block does not show that secret.
- Impact: If the secret is missing in production, any internet client can POST fake Telegram updates. That can create fake support records, trigger admin notifications, and potentially spoof admin-chat `/reply` commands if the attacker knows or guesses the admin chat ID.
- Fix: Fail closed when `TELEGRAM_WEBHOOK_SECRET` is unset in non-local environments, and configure the secret in Cloud Run/Secret Manager.
- Mitigation: Add edge filtering for Telegram IPs only as defense in depth; keep the Telegram secret token check as the primary app control.
- False positive notes: The secret may be injected outside `cloudrun.yaml`; verify runtime env. The app code should still fail closed for production.

### SEC-005: Direct frontend dependency `solid-ui` pulls high-severity vulnerable transitive packages

- Status: Fixed. `solid-ui` was unused and has been removed from production dependencies.
- Rule ID: JS-CONFIG-DEPENDENCY-AUDIT
- Severity: High
- Location: `frontend/package.json:22`
- Evidence: `npm audit --omit=dev --json` reported high findings through direct dependency `solid-ui`, including `serialize-javascript`, `@inrupt/oidc-client`, `@inrupt/solid-client-authn-browser`, `solid-logic`, and `pane-registry`. Audit suggests a semver-major `solid-ui` change as one available fix path.
- Impact: Vulnerable transitive packages in the production dependency tree increase client/build supply-chain risk and may expose auth/XML/serialization attack surfaces if reachable.
- Fix: Confirm whether `solid-ui` is actually used. If unused, remove it. If used, upgrade to a patched compatible version or replace it with the project’s existing local UI components.
- Mitigation: Add `npm audit --omit=dev` to CI after remediation.
- False positive notes: Reachability depends on usage, but the dependency is direct and currently part of the installed tree.

## Medium

### SEC-006: Python dependency audit reports multiple known vulnerabilities

- Status: Fixed. Backend dependency constraints and exported requirements now resolve patched versions, and `pip-audit` reports no known vulnerabilities.
- Rule ID: FASTAPI-DEPLOY-DEPENDENCY-AUDIT
- Severity: Medium
- Location: `backend/pyproject.toml:7-27`, `backend/requirements.txt`
- Evidence: `pip-audit` reported vulnerable transitive packages including `cryptography 46.0.4`, `requests 2.32.5`, `urllib3 2.6.3`, `pyasn1 0.6.2`, `PyJWT 2.11.0`, and `python-dotenv 1.2.1`.
- Impact: Most findings are conditional, but they affect security-sensitive libraries used for TLS, JWT, HTTP, and ASN.1 parsing. Leaving them stale increases exposure and slows incident response.
- Fix: Upgrade to patched versions where available: `cryptography >=46.0.7`, `requests >=2.33.0`, `urllib3 >=2.7.0`, `pyasn1 >=0.6.3`, `PyJWT >=2.12.0`, `python-dotenv >=1.2.2`, then regenerate locks and rerun tests.
- Mitigation: Run `pip-audit` in CI and track exceptions explicitly when a vulnerability is not reachable.
- False positive notes: Some packages are transitive and may not be directly used by app code; still worth updating because they are in the deployed environment.

### SEC-007: Production API docs and OpenAPI endpoints are public by default

- Status: Fixed in app code. Docs/OpenAPI are only mounted for local/development/test environments; production disables `/docs`, `/redoc`, `/openapi.json`, and returns 404 for `/openapi.yaml`.
- Rule ID: FASTAPI-OPENAPI-001
- Severity: Medium
- Location: `backend/app/main.py:46-50`, `backend/app/main.py:145-147`, `backend/cloudrun.yaml:18-24`
- Evidence: `FastAPI` is configured with `docs_url="/docs"` and `openapi_url="/openapi.json"`, and also exposes `/openapi.yaml`. `cloudrun.yaml` sets `ENV=production`.
- Impact: Public docs expose route names, schemas, admin endpoints, webhook names, and auth expectations. This does not bypass auth, but it improves attacker reconnaissance.
- Fix: Disable docs/openapi in production or protect them behind staff auth/internal access. Keep them enabled for local/dev.
- Mitigation: Restrict `/docs`, `/openapi.json`, and `/openapi.yaml` at the hosting/reverse-proxy layer until app-level gating is added.
- False positive notes: Public API docs may be intentional. If so, document that decision and review schemas for information disclosure.

### SEC-008: Firebase Hosting config has no visible security headers or CSP

- Status: Fixed in repo config. `firebase.json`, `firebase.dev.json`, and `firebase.prod.json` now define CSP, frame, content-type, referrer, and permissions headers.
- Rule ID: JS-CSP-001
- Severity: Medium
- Location: `firebase/firebase.json:6-25`
- Evidence: Hosting config defines `public`, `ignore`, and `rewrites`, but no `headers` block for `Content-Security-Policy`, `frame-ancestors`/`X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy`.
- Impact: XSS and clickjacking defenses rely only on application code. A CSP would reduce impact if a raw HTML sink or dependency issue is exploited.
- Fix: Add Firebase Hosting security headers. Start with `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`, and a CSP compatible with Vite/Solid assets and Firebase Auth.
- Mitigation: Verify runtime headers after deploy because some headers may also be configured outside this repo.
- False positive notes: Headers could be set by a CDN/edge layer not visible here; verify deployed responses.

### SEC-009: Custom markdown renderer writes generated HTML via `innerHTML`

- Rule ID: JS-XSS-001
- Severity: Medium
- Location: `frontend/src/components/ui/markdown.tsx:10-19`, `frontend/src/components/ui/markdown.tsx:92-97`
- Evidence: The component uses a custom regex markdown renderer and writes its output with Solid’s `innerHTML`.
- Impact: The current renderer escapes basic HTML before applying markdown replacements, which lowers immediate exploitability. The raw HTML sink is still fragile: future markdown features or parser edge cases can introduce stored XSS when rendering admin-authored or user-authored content.
- Fix: Prefer rendering structured Solid elements without HTML parsing. If rich markdown is required, use a vetted markdown parser plus sanitizer such as DOMPurify and centralize the policy.
- Mitigation: Add CSP/Trusted Types-style hardening where feasible and add regression tests for XSS payloads.
- False positive notes: I did not prove a current bypass in the existing regex renderer; this is a hardening finding for a known dangerous sink.

### SEC-010: Admin-controlled URLs are not consistently validated before storage/rendering

- Rule ID: JS-NAV-001 / FASTAPI-INPUT-VALIDATION-001
- Severity: Medium
- Location:
  - `backend/app/routers/library.py:18-33`, `backend/app/routers/library.py:147-153`, `backend/app/routers/library.py:202-203`
  - `backend/app/routers/questions.py:32-35`, `backend/app/routers/questions.py:181-185`, `backend/app/routers/questions.py:208-214`
  - `backend/app/routers/admin_settings.py:38-53`, `backend/app/routers/admin_settings.py:225-260`
  - `frontend/src/routes/student/StudentQuestionDetail.tsx:80-85`
  - `frontend/src/routes/student/StudentLibraryDetail.tsx:72-77`
  - `frontend/src/routes/student/studentPlanContext.tsx:139-142`
- Evidence: `videoUrl` and step-template `materialUrl` are plain strings in several write models and are later used as `href` or passed to `window.open`. Course lesson URLs have partial normalization, but `_validate_optional_url` preserves legacy/non-standard values instead of rejecting them.
- Impact: A staff account or compromised staff session can store unsafe schemes such as `javascript:` or malformed URLs that execute when another user clicks. This is most relevant for published library/question content and student plan materials.
- Fix: Add shared backend URL validators for all persisted outbound URLs and only accept `https:`/`http:` with a hostname. Consider host allowlists for video/material providers.
- Mitigation: Add frontend guards before rendering/opening URLs so legacy data cannot trigger unsafe navigation.
- False positive notes: Most writes are staff-only, so this is not a public unauthenticated exploit unless staff credentials/content pipeline are compromised.

## Low

### SEC-011: Request validation logging can capture profile request bodies

- Status: Fixed. Validation logging no longer reads or records request bodies, with regression coverage.
- Rule ID: FASTAPI-LOGGING-PII-001
- Severity: Low
- Location: `backend/app/main.py:75-85`, `backend/app/main.py:117-125`
- Evidence: Validation errors on `/api/me` add decoded `request_body` to log context.
- Impact: Invalid profile updates can log personal information such as names, social links, Telegram handles, and free-text profile content.
- Fix: Remove request body logging or redact fields before logging.
- Mitigation: Keep logs access-restricted and retention-limited.
- False positive notes: This does not currently include passwords or bearer tokens, but it is still unnecessary PII collection.

### SEC-012: Backend lacks visible TrustedHost host-header validation

- Rule ID: FASTAPI-DEPLOY-TRUSTED-HOST-001
- Severity: Low
- Location: `backend/app/main.py:71-72`
- Evidence: Middleware setup includes request ID and request logging, but no `TrustedHostMiddleware`.
- Impact: Host-header attacks are only exploitable when the app uses host-derived absolute URLs or trusted proxy assumptions. I did not find a direct exploit path, but this is part of the FastAPI production baseline.
- Fix: Add `TrustedHostMiddleware` with the production Firebase/Cloud Run hostnames, or enforce host validation at the edge.
- Mitigation: Verify Cloud Run/Firebase Hosting host handling and document where this control lives.
- False positive notes: Firebase Hosting/Cloud Run may already constrain host routing sufficiently.

## Positive Findings

- `firebase/firestore.rules:72-74` has a default deny rule.
- Direct frontend Firestore access was not found in `frontend/src`; the client appears to use Firebase Auth plus backend `/api/*` calls.
- Admin mutation routes generally use `require_staff`, and student routes generally scope access to the authenticated user.
- Local secret-bearing files such as `backend/.env`, `frontend/.env.local`, and `*.nogit.*` are ignored by git.
- The API uses bearer tokens in the `Authorization` header rather than query parameters.

## Recommended Fix Order

1. Centralize outbound URL validation and add frontend legacy-data guards.
2. Replace or sanitize the markdown `innerHTML` path.
3. Add TrustedHost host-header validation or document the edge-layer equivalent.
4. Add production dependency audits to CI if they are not already enforced.
