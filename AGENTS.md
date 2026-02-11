# AI Agent Operating Instructions

This document outlines the operational guidelines for AI agents interacting with a codebase and users.

## Core Mandates

- **Adherence to Conventions:** Always prioritize existing project conventions (formatting, naming, structure, libraries) when modifying code.
- **Tool Usage:** Utilize available tools (e.g., `read_file`, `write_file`, `run_shell_command`, `replace`, `search_file_content`, `glob`, `web_fetch`, `codebase_investigator`, `write_todos`) efficiently and appropriately.
- **Security:** Never introduce or expose sensitive information (secrets, API keys). Explain critical commands before execution.
- **Proactiveness:** Fulfill user requests thoroughly, including adding tests where applicable.
- **Conciseness:** Be direct and concise in communication. Avoid unnecessary chitchat.
- **No Assumptions:** Always verify file contents with `read_file` before making modifications.

## Workflow for Software Engineering Tasks

1.  **Understand & Strategize:** Comprehend the user's request and context. For complex tasks, use `codebase_investigator` for comprehensive understanding. For simple searches, use `search_file_content` or `glob`.
2.  **Plan:** Develop a clear, grounded plan based on understanding. Break down complex tasks into subtasks and use `write_todos` to track progress. Share a concise plan if it aids user understanding.
3.  **Implement:** Execute the plan using available tools, strictly following project conventions.
4.  **Verify (Tests):** If feasible, write and run tests to verify changes. Identify correct test commands from project configuration.
5.  **Verify (Standards):** Run project-specific build, linting, and type-checking commands to ensure code quality.
6.  **Finalize:** Consider the task complete after successful verification. Do not revert changes unless instructed.

## Workflow for New Applications (Prototyping)

1.  **Understand Requirements:** Analyze the user's request for features, UX, aesthetic, platform, and constraints. Seek clarification for ambiguity.
2.  **Propose Plan:** Formulate and present a high-level development plan to the user, covering application type, core purpose, technologies (preferring React/Node.js for web, Python/FastAPI for backend, Kotlin Multiplatform/Flutter for mobile, Python/Go for CLIs), main features, and visual design approach. Include placeholder asset strategy if applicable.
3.  **User Approval:** Obtain user approval for the proposed plan.
4.  **Implement:** Autonomously implement features and design elements. Scaffold the application using `run_shell_command`. Create or source placeholder assets for visual completeness.
5.  **Verify:** Review against requirements and plan. Fix bugs, deviations, and ensure visual and functional quality. Build the application and confirm no compile errors.
6.  **Solicit Feedback:** Provide instructions to start the application and request user feedback.

## Tool Usage Best Practices

- **`run_shell_command`:** Explain commands that modify the file system or system state. Prefer non-interactive commands.
- **Token Efficiency:** Use command flags to reduce output verbosity. Redirect large outputs to temporary files if necessary.
- **`replace`:** Provide exact `old_string` and `new_string` with sufficient context.
- **`save_memory`:** Use only for user-specific facts or preferences that should persist across sessions, when explicitly asked or clearly beneficial.

## Git Repository Interaction

- **Before Commit:** Run `git status`, `git diff HEAD`, `git log -n 3` to understand changes and commit style.
- **Commit Messages:** Propose clear, concise commit messages focusing on "why."
- **Confirmation:** Confirm successful commits with `git status`.
- **No Push:** Never push changes without explicit user instruction.

## Project State Confirmation

The current project includes:

- Frontend (Solid.js)
- Backend (FastAPI)
- Firebase Hosting + Firestore rules/indexes (`firebase/`)
- Documentation (API contract, architecture, Firestore rules/schema, OpenAPI spec)
- Testing setup (Firestore rules tests in tests/firebase)
- Admin Q&A + Library features (questions, answers, published entries)
- Student dashboard UI with right-rail layout
- Student profile display name editing (PATCH /me)
- Student area i18n (EN/RU)
- Student step completion dialog i18n + optional comment/link submit flow
- Login account linking for same email across methods (email link + email/password)
- Admin goals template path editor (template steps)
- Admin student management (roles, status, goals, step reorder + delete, reset from template, delete student with double confirmation)
- Admin step completions moderation (list, patch comment/link, revoke)
- Admin students list progress metrics (percent + done/total)
- Frontend data access routed via backend APIs (`/api/*`)
- Frontend unit tests (Vitest + @solidjs/testing-library)
- CI tests on push/PR (GitHub Actions)

Follow the above workflows and update documentation and test configuration as the project evolves.
