# Classpaper verification — 2026-10-13

The app is a functional local release, not a claim of complete Schoolhouse parity.

## Checked

- TypeScript production build and 28 passing automated checks.
- Domain grading, multiple-answer duplicates, locked/grouped shuffling and choice limits.
- Active student projections omit answers, teacher notes, original pictures/recipes, list guides, part guides and hidden table cell values.
- Native ZIP round trip; GIFT reserved characters/Unicode, weighted/malformed input; CSV quoting, mapping, no-heading files and BOM.
- Three supplied Schoolhouse sample tests and the incomplete template: supported types import; the template's missing correct answer is reported.
- Independent 1EdTech choice, ordering, essay/rubric and mapped-scoring fixtures. Mapped scoring is rejected. Scorer-only content remains private.
- Representative choice, ordering, essay and assessmentTest exports validated with xmllint against official QTI 2.1 schemas. Styles disallowed by QTI produce export warnings.
- API lifecycle: teacher accounts, ownership, save conflicts, publication immutability, access code, concurrent attempt limits, response persistence, submission retry, teacher grading, closed links, print snapshots and presets.
- Browser teacher→student→teacher walkthrough: shared a five-question example; objective score 4/7 with essay pending; teacher grading changed the result to 7/7.
- Rich text edit and print preset creation; added a table whose correct cell was concealed in student preview. Guided CSV column mapping produced the expected question and answer preview.
- Picture upload, annotation save and reopening of the editing recipe.
- At phone viewport 390×844, student content fit without horizontal page overflow; a table answer persisted after reload.

## Not yet established

- Full compatibility with all .tst versions/types, GIFT variants, QTI engines or scoring rules.
- Docker build/runtime, external PostgreSQL deployment and backup restore.
- Actual ZipGrade key import or phone scanning.
- All image operations and long/multi-page print layouts across browsers.
- Real teacher/student usability, accessibility conformance or high-concurrency load capacity.
- External hosting. The running preview is localhost only, with fictional sample data in a separate preview database.

## Artifacts

- Design: `docs/superpowers/specs/2026-10-12-teacher-test-app-design.md`.
- Functional capability matrix and run instructions: `app/README.md`.
- Local-only reverse-engineering evidence ledger (not distributed): `analysis/findings.md`.
- Official QTI fixture sources: https://www.imsglobal.org/question/qtiv2p1/examples/items/ .
- Local-only schema source/dependency mapping (not distributed): `analysis/qti-schema/schema-map.json`; downloads retain original namespace bindings.
- Local-only representative XML (not distributed): `analysis/qti-export/`.
- Teacher screenshot: `docs/screenshots/teacher-editor.jpg`.

## GIFT verification update — 2026-10-13

An independently authored six-question GIFT fixture exercised file dispatch for multiple choice, true/false, short answer alternatives, essay, matching and numerical questions. All answer mappings and category retention passed. The browser upload showed six valid questions with expected answers and title-loss warnings; warnings were acknowledged and the questions were imported into a separate preview test. Screenshot: `docs/screenshots/gift-import.jpg`.

A clone does not include extracted proprietary samples. The corresponding optional migration test skips when those local files are absent; the remaining 27 checks are self-contained.
