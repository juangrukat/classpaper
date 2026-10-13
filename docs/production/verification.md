# Production verification — 2026-10-13

## Environment and reproduced checks

- Node 22; React/TypeScript production frontend build.
- Podman 6.1.3 with a dedicated ARM64 Linux VM, 2 CPUs and 3 GB RAM.
- PostgreSQL 17 container with a separate disposable database.
- Application image built from the repository Dockerfile, unprivileged user, all capabilities dropped, no-new-privileges, 1 GB memory cap and 256-process cap.
- The actual Compose stack started with service health dependencies, persisted volumes and the same constrained app settings; the app health check reported healthy.
- Container lifecycle: teacher creation, test publication, student response save/submission, objective score, teacher override, source-file retention, presets, immutable print version and Chromium PDF download.
- Backup: `pg_dump -Fc`, fresh database creation and `pg_restore --exit-on-error`. Restored app confirmed account sign-in, test, submitted attempt, override, unchanged source file and saved print snapshot through APIs.
- Fifty concurrent students started, saved and submitted; no failed requests. Timing and environment are in `evidence/load-check.json`.
- Security checks: administrator isolation, self-disable prevention, disabled-account session invalidation, expiring single-use password/device recovery, rotated attempt tokens, cross-owner archive and attempt-control denial, cross-site-write denial and production CSP.
- Multi-blank choice scoring/public privacy; per-part marks and sum validation; pending-grade exclusion in item statistics; Aiken invalid-key reporting; CSV answer/tolerance round trip.
- Chromium generated 45-question PDFs for A4/Letter and one/two columns. Text extraction confirmed every question exactly once. Expected page sizes and multi-page outputs were checked. Representative first/last pages were rendered and inspected. Oversized-block checking is tested positively, rather than only checking empty warning reports.
- Browser walkthrough: two inline choices saved; freehand drawing and labels saved; student submission; teacher per-part grading and diagram review yielded 6/6; item statistics updated; private original-source archive was visible. Picture flip/effect/undo/redo controls were exercised. Pointer-event drawing failure found during QA was fixed and retested.

## Evidence and repeatability

`app/test/production.test.ts` exercises the operational/security flows. Set `CHROMIUM_PATH` when running tests to include actual PDF generation. `app/scripts/verify-deployment.ts` runs the real external-database/container smoke test, and `VERIFY_RESTORE=true` verifies its restored records. The verification state (including generated QA credentials) stays in ignored `app/data/`; it is not committed.

Screenshots under `docs/screenshots/` and synthetic PDFs/validation output under `evidence/` contain fictional QA data only. CI is defined in `.github/workflows/verify.yml`. CI results should be read from GitHub rather than inferred from this file.

## Limits

No public production server was deployed. Configure your domain, HTTPS proxy and backups before admitting real students. Real phone/ZipGrade scans and representative teacher/student research were not possible here and are not counted as completed. The completed backlog percentage is a count of documented outcomes, not a percentage estimate of quality or interoperability.

Final local run: **32/32 checks pass**, including real Chromium PDFs, keys/sheets and a deliberately oversized question. A clean clone skips the optional proprietary-sample check and runs 31 tests.

GitHub Linux CI passed for source commit `8f80fc0`: [build, tests, Docker/PostgreSQL/PDF smoke run](https://github.com/juangrukat/classpaper/actions/runs/38336360147). The clean runner passed all 31 distributable checks and skipped only the optional proprietary-sample migration check. Temporary local QA containers and the dedicated VM were stopped after verification; the embedded-data preview remains running.
