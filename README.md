# Classpaper

**Create a test once. Print it for the classroom or share it online.**

Classpaper is a self-hosted assessment app for teachers who need clear, straightforward tools without managing a full learning management system. It combines a reusable question bank, rich question editing, guided imports, printable tests and answer keys, and quick online testing with saved responses and teacher grading.

This is a working first release, not complete feature parity with Schoolhouse Test. It is an independent implementation informed by documented functionality and local file-format analysis.

![Classpaper teacher editor](docs/screenshots/teacher-editor.jpg)

## What it does

- Author 17 question types with rich text, pictures, grouping, marks and duplicate checks.
- Reuse questions from a searchable bank with instant previews.
- Preview imports before accepting them, with explicit reports of unsupported data or conversion losses.
- Import GIFT, CSV/TSV, native Classpaper ZIP, a bounded QTI 2.1 subset and supported Schoolhouse 5 `.tst` structures.
- Print tests, answer sheets and keys with saved layouts and reproducible randomized versions; save PDFs through the browser.
- Share quick student tests with access codes, time limits, autosaved responses and objective or teacher grading.
- Export results as CSV, full native packages, supported GIFT/QTI questions and eligible ZipGrade keys.

## GIFT import, tested

The included [sample file](app/test/fixtures/common-questions.gift) imports six common types: multiple choice, true/false, short answer with accepted alternatives, essay, matching and numerical. Automated tests check answer mappings, category retention, Unicode/escaped reserved characters, malformed questions and explicit rejection of unsupported partial-credit weights. A browser walkthrough uploaded the file, reviewed its six questions and acknowledged conversion warnings before creating the test.

![GIFT question review](docs/screenshots/gift-import.jpg)

![Imported GIFT test with six question types](docs/screenshots/gift-imported-test.jpg)

GIFT support is a tested subset. Titles, feedback, tags and formatting can be lost with warnings. Full Moodle interoperability has not been established.

## Quick start

Requires Node.js 22 or later.

```sh
git clone https://github.com/juangrukat/classpaper.git
cd classpaper/app
npm ci
npm run dev
```

Open http://localhost:3100 and create the first teacher account. Local data uses persistent embedded PostgreSQL (PGlite). For a production frontend build, run `npm run build` followed by `npm start`.

For Docker with PostgreSQL:

```sh
cd classpaper/app
cp .env.example .env
# Set a unique POSTGRES_PASSWORD in .env.
docker compose up --build -d
```

See the [deployment and capability guide](app/README.md) for HTTPS configuration, registration controls, backups and format limitations. Container startup, external PostgreSQL and backup restoration still need validation; Docker was unavailable on the development machine.

## Verification and status

The production frontend builds successfully. On 2026-10-13, all **28 automated checks** passed locally, covering question scoring, private answer concealment, imports, randomization and the teacher/student API lifecycle. Browser walkthroughs cover editing, GIFT/CSV import, sharing, submission, manual grading, picture editing and mobile-width save/resume.

A clean clone runs 27 checks and skips one optional migration check that requires the original proprietary sample files; these are intentionally not distributed. Detailed evidence and remaining checks are in [verification notes](docs/verification.md).

Before treating this as a fully validated production replacement, remaining work includes Docker/restore rehearsal, real ZipGrade imports/scanning, broader GIFT/QTI/native migrations, multi-page print QA and representative teacher/student usability and accessibility testing. Password recovery and account administration are also pending.

## Source layout

- `app/src`: React and TypeScript teacher/student UI.
- `app/server`: Express API, PostgreSQL storage and interchange adapters.
- `app/test`: automated checks and distributable fixtures.
- `docs`: implementation/design notes, verification and screenshots.

Original installers, extracted third-party binaries/assets, local databases, environment secrets and student responses are excluded from this repository. Dependency licenses remain with their respective projects. No project license has been selected yet.
