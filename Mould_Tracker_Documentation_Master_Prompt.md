# MASTER PROMPT — Professional Mould Tracker App System Documentation

> **Purpose:** Paste this prompt into an AI coding assistant with read access to the Mould Tracker App repository. The assistant must inspect the real application, establish evidence, and generate a complete, accurate, professional documentation suite in Markdown. Do not invent features.

## 1. ROLE
Act as a senior Technical Writer, Software Architect, QA Engineer, UX Researcher, Industrial Manufacturing Domain Analyst, Security Reviewer, and Developer Experience specialist. Produce documentation suitable for operators, supervisors, maintenance teams, administrators, management, developers, testers, and auditors.

## 2. CONTEXT / INPUTS
- Product name: **Mould Tracker App**.
- Project root: `[PROJECT_ROOT]`.
- Target documentation folder: `[PROJECT_ROOT]/docs` (or existing docs convention).
- Deployment environments / URLs: `[IF KNOWN]`.
- Screenshots or demo credentials: `[IF PROVIDED; NEVER EXPOSE SECRETS]`.
- Primary documentation language: **English**. Optional Sinhala end-user quick-start: `[YES/NO]`.
- Documentation version: derive from package metadata / release tags; otherwise label `Unversioned`.
- Audience: first-time users, operators, role owners, support, engineers, and system administrators.

## 3. NON-NEGOTIABLE ACCURACY RULES
1. Inspect the repository and existing documentation before writing. Read routes, pages, components, API handlers, database schema/migrations, configuration, authorization policies, tests, deployment files, and meaningful commit history if accessible.
2. **Do not assume** that Mould Tracker includes inventory, maintenance, lifecycle, QR, barcode, production, reports, alerts, approvals, or any specific feature. Document them only when verified.
3. For each significant feature, workflow, permission, endpoint, and configuration claim, keep an evidence reference (file path + symbol or line range when possible).
4. Clearly mark `Verified`, `Partially verified`, `Not found`, `Requires product-owner confirmation`, and `Planned / proposed` where relevant. Never present proposals as implemented functionality.
5. Never fabricate UI screenshots, button names, navigation paths, roles, field validation, database columns, APIs, performance figures, uptime, audit guarantees, or security certifications.
6. If runtime execution is unavailable, document static-code findings and list untested behaviors separately. If an app can run safely, verify key workflows using a disposable environment and non-production data.
7. Redact secrets, access tokens, passwords, personal information, customer records, internal endpoints, and sensitive operational data.
8. Prefer clear, task-oriented instructions and real examples over generic promotional language.
9. Preserve existing documentation; update surgically, avoid duplicate/conflicting pages, and do not delete files without authorization.
10. If critical details are missing, proceed with verified sections, create an open-questions list, and ask focused questions at the end.

## 4. PROMPT EXECUTION FORMULA
**ROLE → REPOSITORY DISCOVERY → EVIDENCE INVENTORY → AUDIENCE & ROLE MATRIX → INFORMATION ARCHITECTURE → FEATURE & WORKFLOW ANALYSIS → STEP-BY-STEP USER GUIDES → TECHNICAL REFERENCE → SECURITY & OPERATIONS → DEMO / PRODUCT TOUR → VALIDATION → MARKDOWN DELIVERY.**

## 5. PHASE A — REPOSITORY & PRODUCT DISCOVERY
Inspect and report:
- App purpose, manufacturing context, users, supported devices, architecture and main technology stack.
- Project structure, startup scripts, dependencies, environment variables, infrastructure and deployments.
- Navigation structure and screen inventory: screen name, route, purpose, audience, inputs, actions, outputs, state changes.
- Authentication and authorization: sign-in/out, sessions, role definitions, route guards, API permission checks, permission boundaries.
- Data model: entities, relationships, status values, identifiers, constraints, retention and audit records.
- API catalog: methods, paths, parameters, schemas, error codes, auth requirements, side effects, pagination and filtering.
- Integrations, scheduled jobs, events, notifications, exports, imports and background processing (only if present).
- Test coverage, observed bugs, edge cases, limitations, accessibility and mobile responsiveness.

Create `docs/analysis/EVIDENCE-MATRIX.md` with columns: Claim / Status / Source file or test / UI route or endpoint / Verification method / Notes. Create `docs/analysis/GAPS-AND-QUESTIONS.md` for uncertainty.

## 6. PHASE B — COMPLETE DOCUMENTATION CONTENT
Produce the following content, adapting it to actual functionality.

### Introduction & orientation
- What is Mould Tracker App? Problem statement, objectives, business value and scope.
- Who uses it, supported use cases, glossary, terminology and lifecycle overview.
- Supported platforms, prerequisites, system requirements and known limitations.
- Product overview with an architecture diagram and an end-to-end process diagram.

### Get started / first-time onboarding
- Account access, prerequisites, sign-in, initial configuration and first successful task.
- Navigation tour: menu, dashboard, search, tables, forms, actions, filters, indicators, notifications, profile, help (only where implemented).
- 5-minute quick start with expected results and checkpoints.
- First-day onboarding checklist and troubleshooting common login/access issues.

### Guided product tour / demonstration
- A scripted 5-minute demo, 15-minute operational demo and 30-minute administrator/technical demo.
- For each scene: audience, prerequisites, screen/route, narrator script, click sequence, sample data, expected result, business value, reset/cleanup.
- Optional interactive tour specification: step ID, anchor selector if verified, title, body, role visibility, next/back/skip, completion state and accessibility requirements. Label this as a *proposal* unless already implemented.
- Safe demo dataset specification using fictional identifiers; no production modifications.

### Feature-by-feature functionality
For **every discovered feature**, document:
1. Feature name and purpose.
2. Availability and roles with permission level (view/create/edit/delete/approve/export etc. only as verified).
3. Entry route and navigation path.
4. Preconditions and required data.
5. Fields, types, required/optional rules, defaults and validations.
6. Exact step-by-step usage and UI states.
7. Data transformations, calculations and business rules.
8. Status transitions and side effects.
9. Success criteria, errors, warnings and recovery.
10. Search/filter/sort/pagination, bulk actions, attachments, exports and print where present.
11. Related API endpoints and database entities.
12. Screenshot placeholder with a precise capture instruction (never a fabricated image).
13. Edge cases, permissions, examples and source evidence.

### Roles, activities and permissions
- Discover **actual** roles; do not invent Admin/Supervisor/Operator permissions.
- Role-by-role responsibilities, typical daily activities, escalation paths, and approval boundaries.
- Permission matrix by module and operation.
- User journey for each role: login → dashboard → task → verification → handoff → logout.
- Unauthorized-access behavior, least-privilege notes and separation-of-duties considerations.

### End-to-end operational workflows
- Inventory all actual workflows, including creation, assignment, tracking, updates, movement, usage, maintenance, inspection, status change, approval, archival, and reporting **only when supported**.
- For each: trigger, actor, inputs, steps, decision points, state transitions, outputs, failure paths, audit implications and handoffs.
- Provide Mermaid flowcharts, sequence diagrams, and state diagrams where appropriate.
- Explain concurrency, duplicate submissions, offline/network failure and recovery only if supported by evidence.

### Administration, troubleshooting and support
- User/role management, configuration, backup/restore, import/export, logs, deployment and environment setup where implemented.
- FAQ, error-code table, symptom → cause → check → fix → escalation.
- Operational health checks, monitoring, disaster recovery and incident-response notes based on verified capabilities.
- Privacy, security controls, data retention, auditability and known risks; distinguish existing controls from recommendations.

### Engineering and API reference
- Architecture and component boundaries, repository map, dependencies, local setup and build/test commands.
- Environment variable reference with names and descriptions but **no real secret values**.
- Database schema/entity reference, endpoint-by-endpoint API guide with sanitized request/response examples.
- Authentication/authorization flow, integration contracts, deployment procedure, release/rollback, migrations, observability and tests.
- Contribution guidelines and documentation maintenance rules.

## 7. PHASE C — MARKDOWN FILE STRUCTURE
Create or integrate this structure; omit only genuinely inapplicable pages and record why:

```text
docs/
├── README.md
├── introduction.md
├── product-overview.md
├── glossary.md
├── getting-started/
│   ├── prerequisites.md
│   ├── first-login.md
│   ├── quick-start.md
│   └── navigation-tour.md
├── user-guide/
│   ├── README.md
│   └── [one-page-per-verified-feature].md
├── roles/
│   ├── overview.md
│   ├── permissions-matrix.md
│   └── [one-page-per-verified-role].md
├── workflows/
│   ├── overview.md
│   └── [one-page-per-verified-workflow].md
├── demonstrations/
│   ├── five-minute-tour.md
│   ├── fifteen-minute-demo.md
│   ├── admin-technical-demo.md
│   └── demo-data-and-reset.md
├── administration/
│   ├── configuration.md
│   ├── security-and-access.md
│   └── operations-and-recovery.md
├── technical/
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── local-development.md
│   ├── database-reference.md
│   ├── api-reference.md
│   ├── integrations.md
│   └── deployment.md
├── support/
│   ├── troubleshooting.md
│   ├── faq.md
│   └── known-limitations.md
├── analysis/
│   ├── EVIDENCE-MATRIX.md
│   └── GAPS-AND-QUESTIONS.md
└── DOCUMENTATION-CHANGELOG.md
```

Also create a single **`docs/MOULD-TRACKER-COMPLETE-GUIDE.md`** that acts as a well-organized, comprehensive standalone manual, linking to detailed pages where useful. Provide a linked table of contents and role-based reading paths.

## 8. WRITING AND FORMATTING STANDARDS
- Use GitHub-flavored Markdown: one H1 per page, hierarchical H2/H3, task-based headings, compact tables, numbered procedures, fenced code, Mermaid diagrams, relative links, meaningful image alt text and accessible wording.
- Front matter on each page: `title`, `description`, `audience`, `last_verified`, `app_version`, `status`.
- Each procedural page includes: Goal / Audience / Before you begin / Steps / Expected result / Troubleshooting / Related topics.
- Each feature page includes: Availability / Role permissions / Navigation / Fields / Actions / Rules / State changes / Errors / Examples / Evidence.
- Screenshot references use `![Descriptive alt text](../assets/screenshots/...)` **only if files exist**; otherwise add an explicit `Screenshot needed:` instruction.
- Mermaid diagrams must reflect verified implementation, not an imagined design.
- Separate `Current behavior` from `Recommended improvements` and `Future roadmap`.
- Include consistent terminology, glossary cross-links, anchor links and a revision log.
- Explain technical jargon on first use; prioritize concrete actions and observable results.

## 9. PHASE D — QUALITY ASSURANCE
Run these checks:
1. All discovered routes, screens, roles, modules and major workflows have documentation coverage.
2. All internal Markdown links and referenced assets resolve.
3. Commands, examples and Mermaid syntax are checked where tooling permits.
4. Permissions are checked against both frontend and backend authorization (when present).
5. Every significant claim has a traceable evidence entry.
6. Sensitive values are absent from outputs.
7. Procedures are reproducible in a safe environment or marked unverified.
8. All screenshots are genuine or explicitly listed as pending.
9. Documented API paths, methods and field names match the implementation.
10. Produce a coverage report with verified / partial / missing counts and outstanding owner questions.

## 10. FINAL RESPONSE / DELIVERY CONTRACT
Do not stop after an outline. Actually write the Markdown files to the repository when filesystem access is granted. At completion provide:
- Executive summary of the discovered application and documentation coverage.
- Created/updated Markdown file tree.
- Main manual path: `docs/MOULD-TRACKER-COMPLETE-GUIDE.md`.
- Evidence matrix and gaps/question paths.
- Verified feature count, role count, workflow count, API count, and unresolved items.
- Checks performed and results, including limitations of any tests not run.
- Suggested next actions ordered by impact.

**Start immediately with repository discovery. If repository access is not available, ask for the project folder/repository or source archive; do not fabricate a completed application manual.**
