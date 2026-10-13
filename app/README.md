# Classpaper

A working self-hosted test authoring and quick-assessment app for teachers and students. React/TypeScript, Express and PostgreSQL. Local development uses persistent embedded PostgreSQL (PGlite).

## Try the current preview

The local preview is at http://localhost:3100. It uses a separate `data/preview` database with fictional tests and student attempts. The teacher account is `preview@classpaper.test`, password `classpaper-preview-only`. These are preview-only credentials; no demo account is created automatically by the app.

## Run your own local workspace

```sh
cd classpaper/app
npm ci
npm run dev
```

Create your teacher account in the browser. Default data persists in `app/data/postgres`, separate from the preview. Stop the preview process before starting another process on port 3100, or set `PORT=3101`. Stop the server before copying the embedded database directory as a development backup.

New teacher registrations close after the first account unless `ALLOW_REGISTRATION=true` is set. Existing teachers can sign in normally. The first teacher is the server administrator. Administrators can disable/re-enable teachers and issue single-use recovery links; operators can recover the administrator from the server. See [production deployment](../docs/production/deployment.md).

## Run with Docker

```sh
cd classpaper/app
cp .env.example .env
# Edit .env and replace POSTGRES_PASSWORD.
docker compose up --build -d
```

The app binds to localhost:3100. Create the initial teacher account before enabling remote access. For a hosted server, put an HTTPS reverse proxy in front of port 3100, set `PUBLIC_URL` to the exact HTTPS origin and `COOKIE_SECURE=true`. Keep the database port private. Enable `ALLOW_REGISTRATION` only when additional teachers should be able to register.

The Dockerfile was built and launched with Podman on ARM64, with PostgreSQL 17, PDF generation and an actual backup/restore rehearsal. Deployment uses an unprivileged app user, dropped capabilities, bounded rendering, health checks and secure-cookie/proxy configuration. See [production verification](../docs/production/verification.md) and the [deployment guide](../docs/production/deployment.md).

## Teacher and student workflow

1. Create a test, add questions, reuse the bank, or import a file.
2. Mark correct answers; review incomplete questions before sharing.
3. Preview, then Print. Download a server-generated PDF or save one through browser printing. The print URL stores a version identifier; reopening it preserves its randomized order and matching key.
4. Set a time limit, access code, attempts and feedback policy, then Share. Copy the student link.
5. Students enter their name and ID. Responses autosave; reload in the same browser to resume.
6. Review Results. Grade written answers, override marks with feedback, or export CSV.

A publication is an immutable snapshot. Draft edits cannot change existing attempts. Closing test links prevents new starts; existing attempts can finish. Student IDs identify responses but do not authenticate identity. Attempt allowances apply to the entered ID. This is quick classroom assessment, not proctoring.

## Implemented capabilities

| Area | Working functionality |
| --- | --- |
| Authoring | Teacher accounts and separate workspaces; autosave and conflict detection; visual editors; preview; duplicate-text warnings |
| Question types | Multiple choice, true/false, short answer, essay, matching, ordering, blanks, inline selection, multi-match, numerical, list, prompted list, checklist, statements, table, diagram and multi-part |
| Text | Bold/italic/underline, superscript/subscript, bullet and numeric/alphabetic/Roman lists, alignment including justified, symbols and nonbreaking characters |
| Pictures | Upload and descriptions; resize, crop and position, rotate, horizontal/vertical flip, drawing, 30-edit session undo/redo, up to ten positioned labels, brightness/contrast, grayscale/sepia/invert/vivid/blur; original and editing recipe retained privately |
| Bank | Save independent copies, search by text/category, type filter and immediate preview |
| Randomization | Question/group-unit order, unlocked choices, mandatory correct/locked choice retention with a displayed-choice limit |
| Printing | A4/Letter, one/two columns, spacing, page breaks, keep-together, saved header/footer/layout presets, text/image watermark, grouped decimal numbering, marks orientation, answer keys and sheets |
| Interchange | GIFT diagnostics and limited export; CSV/TSV with a template or column mapping; complete native ZIP; bounded QTI 2.1 package/item adapters; partial Schoolhouse 5 XML migration |
| Online | Deadline extensions, single-use device recovery, per-part grading, graded-only item statistics, link/access code, lightweight student identification, server deadlines, saved responses, retry-safe submission, objective and teacher grading, audited grade changes, CSV results |
| ZipGrade | Primary-key CSV export from the saved print version; link to official standard forms; supported tests require at most 100 multiple-choice-type questions with at most five choices |

Objective scoring is all-or-nothing. Short-answer text matching ignores case and repeated spaces; numerical tolerance is absolute. Written lists, prompted lists, essays, diagrams and multi-part questions use teacher grading. Multi-part questions support individual part grades with a validated total. Tables automatically grade selected answer cells. Diagram students can attach an image or draw and label their answer in the browser.

## Import/export details

- **Native ZIP** preserves the implemented question model, pictures, original pictures/recipes, instructions and settings. Import it from My tests to recreate a document including its settings. Importing into an existing test adds question copies and keeps the destination settings.
- **GIFT** supports common types. Unsupported weights are rejected; feedback/title/tag and formatting losses are reported. Multiple-answer export and several specialist types require the native package. This is a tested subset, not a complete Moodle adapter.
- **Aiken** imports single-answer lettered choices from `.aiken` or `.txt` files with `ANSWER: A` style keys and reports incomplete/invalid questions.
- **CSV/TSV** import/export supports multiple choice, true/false, short answer, essay and numerical. Use the downloadable template or map existing columns. Correct choices use letters (including A|B for multiple answers), true/false, or exact choice text on import. Export preserves numerical tolerance and reports skipped types/formatting. Formula-like fields get an apostrophe prefix with a warning for safe spreadsheet opening. Files with and without headings, quoted multiline fields and UTF-8 BOM are supported; import at most 500 questions at a time.
- **QTI 2.1** import handles single-interaction choice/inline-choice, ordering, text-entry strings and extended-text items, packaged or standalone. Export handles choice-based questions, ordering and manually graded text. Mapped/partial-credit, adaptive, composite and other interactions are rejected or omitted with a report. Import converts text formatting to plain text. Export removes unsupported styles with warnings. Official independent examples are tested, and representative item/test XML exports were validated against the official XSD. This is not universal QTI compatibility or interoperability certification; another delivery engine has not yet been tested.
- **Schoolhouse .tst** migration handles verified version 5 multiple-choice, true/false and written-answer structures, with recognized stem images. RTF styling, document layout, choice images and nested answer mappings are not yet reproduced. Unknown items and hidden-key-text items are reported/skipped. Keep the original files. No version 6 format claim is made.

Imports are previews, never silent partial transfers. Losses/skips require acknowledgement before adding the shown questions. Original import files are retained privately in the importing teacher’s source archive and can be downloaded unchanged. The archive has a 200 MB encoded-data quota per teacher and is included in database backups.

Native packages validate typed contents. Only local PNG/JPEG/GIF/WebP data images are accepted; importers do not fetch external images. HTML is sanitized and student projections remove grading fields, private notes, original pictures and table answers. Limits: 15 MB input, 20 MB expanded ZIP, 600 ZIP entries and 26 MB JSON request/save size. Pictures are currently embedded in database JSON; large libraries should eventually use separate asset storage.

## ZipGrade boundary

The CSV follows ZipGrade's documented five-column key format and maps letters to the exact saved print order. Use official answer sheets from https://www.zipgrade.com/forms/; the app's generic answer sheet is not a validated ZipGrade form. A key-file import replaces existing ZipGrade key versions, so review it before importing. Real phone scans and key import have not been verified here.

Reference: https://support.zipgrade.com/hc/en-us/articles/37271000797453-CSV-Answer-Key-Import-File-Requirements-and-Options

## Verification

```sh
npm run build
npm test
```

Tests cover grading/answer identities, locked and grouped shuffling, choice limits, table/list/part privacy, original-image privacy, GIFT escaping and errors, native packages, multiline/mapped/BOM CSV, supplied .tst samples and independent official QTI fixtures. A separate temporary server/database verifies teacher/student publication, workspace isolation, access code, concurrent attempt limits, save/resume, immutable publications, retry-safe submission, manual grading, post-submission protection, presets, saved print versions and cross-origin writes.

Browser walkthroughs verified teacher editing, formatting, preset creation, sharing, student submission, manual grading, table answer concealment, picture edit reopening, and phone-width save/resume. These are developer checks, not usability research with representative teachers or students. See [verification notes](../docs/verification.md) for remaining validation boundaries.

## Remaining work before claiming full parity

The fixed [production backlog](../docs/production/backlog.md) records **24/30 completed outcomes (80%)** with evidence. This is an outcome count, not production certification or an effort estimate.

- Wider GIFT policy/mapping and external-consumer testing.
- Wider QTI mappings and external assessment-engine testing.
- Broader Schoolhouse migration: RTF fidelity and nested types.
- Arbitrary table spans/styling and layout controls beyond the grid editor.
- Real ZipGrade key import and phone scans.
- Representative teacher/student usability and accessibility testing.

See the [deployment guide](../docs/production/deployment.md) for password recovery, account administration, classroom attempt recovery, proxy configuration, PDF rendering and upgrades. Picture undo/redo is bounded to the current editor session; saved labels/effects/recipe remain reusable. Print checks cover representative layouts and report overflow; they do not prove every possible document/browser combination.

## PostgreSQL backup

```sh
docker compose exec -T db pg_dump -U classpaper -d classpaper -Fc > classpaper-backup.dump
```

Restore into a clean database with `pg_restore` and rehearse the restore before relying on it. Current pictures, attempts, grade audit, presets and print versions are all in the database dump. The media volume is reserved for future separate asset storage. Never commit `.env`, databases, backups or student responses.
