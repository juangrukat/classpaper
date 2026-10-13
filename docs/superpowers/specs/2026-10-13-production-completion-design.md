# Production completion design

This continues the user-approved Classpaper design and the explicit request to prioritize important features and autonomously complete at least 80% of documented outstanding work. No new LMS or change of architecture is proposed.

Keep React/Express/PostgreSQL and the teacher-first flow. Implement focused operational modules for account recovery/administration and classroom attempt controls; recovery codes are single-use, hashed, teacher-authorized and never returned on public endpoints. Password recovery uses server-operator-issued expiring links, avoiding an unconfigured email dependency. The first account is the server administrator; administrator access is owner-independent only for account maintenance, never student grading.

Add bounded interchange adapters, source-file retention scoped to the importing teacher, student drawing, multi-blank inline selection, per-part grades, image effects/history/annotations, explicit shuffle controls and printable layout variants. PDF rendering reuses immutable print snapshots through a private loopback render session. Chromium is isolated, external network requests are blocked and concurrent rendering is bounded. Container and external PostgreSQL checks use a separate disposable test deployment, including backup and restore.

The fixed backlog in docs/production/backlog.md defines the denominator and acceptance evidence. Do not count broad compatibility or real classroom/phone validation as complete based on self-tests. Test security boundaries, restore actual persisted records, inspect representative print PDFs and verify changed teacher/student browser paths. Preserve readable limitations in the repository description and README.

Alternatives considered: feature-only polish would leave deployment risk; replacing the architecture would delay teacher functionality and migration. Completing operational foundations first, then high-value workflows and format/layout improvements, addresses both reliability and usability.
