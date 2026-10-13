# Teacher test authoring and quick assessment

Status: detailed design for user review. The high-level direction was approved with “ok.. go”; this document makes scope and acceptance criteria concrete before implementation.

## Purpose and users

Build an independent browser application that combines Schoolhouse-style test authoring and printing with Testmoz-style quick student testing. Teachers with limited technical confidence are the primary users. Students need an accessible, phone-friendly test experience. Reliable question interchange is a central product capability.

The supplied Schoolhouse Test 6 feature list defines intended functionality. The supplied executable is Schoolhouse Test 5.1.0.4; its samples and help inform migration and behavior, but do not verify version 6 implementation.

## Deployment decision

Recommended: a web application and PostgreSQL packaged with Docker Compose, including persistent media storage and a Chromium PDF worker. One installation can serve one teacher or several teachers. Students open a shared URL. HTTPS is required for a hosted installation; local development uses localhost. Database and media backups must be documented and restorable.

Alternatives considered:

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Hosted browser application in Docker | Shared access, consistent printing, simple student links | Requires hosting and backups |
| Local browser application | Convenient private authoring without hosting | Remote student access requires a reachable host |
| Desktop application | Strong offline access | Separate installations and more work for online testing |

Implement the hosted browser application. Keep authoring data portable so local deployment remains possible. Offline student testing is outside the first release.

## Teacher workflow and interface

Primary navigation: My tests, Question bank, Results. Settings are secondary. Plain-language buttons use text, not icons alone. A teacher can start a blank test, copy an existing test, or import questions.

The test workspace has a short question outline, a central visual editor, and an optional preview. Its main actions are Add question, Preview, Print, and Share. It autosaves and displays Saving, Saved, or a specific retryable failure. Unfinished questions are visibly marked. Publishing is blocked when required answers or content are missing, with links to the affected questions. Teachers can still save unfinished work.

Question types appear as cards with one-sentence explanations and examples. Teachers mark correct choices with an explicit “Correct answer” control. Marks default to 1. Advanced controls for randomization, metadata, and layout are collapsed. Duplicate checks warn and offer review; they never delete or merge automatically.

The bank supports text search, type/category/tag filters, instant preview, multiple selection and Add to test. Adding creates a test-local snapshot: later bank edits do not silently change an existing test. Teachers can deliberately refresh or save a changed question back to the bank.

Import workflow: Choose file → Review questions and warnings → Import. Detect supported formats, provide a manual override, show readable line/question errors, and let teachers correct text or explicitly select valid questions. No silent partial import. Spreadsheet imports show sample rows and field mapping. GIFT source editing is optional, with diagnostics and rendered preview.

Export workflow: choose a destination such as Backup including pictures, GIFT, QTI or Spreadsheet. Before download, show which questions transfer exactly, require conversion, or cannot transfer. Downloading a reduced export requires acknowledging the listed losses. Native backup remains available with complete data.

First-time teachers should be able to create a five-question test, find its answer key, print it and share it without reading documentation. Usability testing must measure task completion with representative teachers; automated tests cannot prove this criterion.

## Question model and functionality

Use stable question, choice and asset IDs; do not identify correct answers by display letters. Store typed question content, rich text, marks, accepted answers, feedback, metadata and asset references separately from presentation. Preserve original imported data and a conversion report for migration review.

Support multiple choice (single and multiple answers), true/false, short answer, essay, fill-in-the-blanks, matching, ordering, checklist, statements, list, list with prompts, table, diagram, multi-part, selection and multi-match. Numerical questions imported from GIFT need an explicit numerical model with tolerances. Do not flatten unfamiliar types into multiple choice.

Selection supplies inline alternatives. Multi-match permits a choice to be reused or unused. Groups can carry shared stimulus text/images and nested numbering. For online diagram responses, the student can submit an image or use a drawing surface; teacher grading is required. Essays, unconstrained lists and free responses use teacher grading by default. Short answers and blanks can opt into explicit accepted-answer rules. Exact case/whitespace behavior and partial-credit rules must be visible to teachers.

Rich text supports bold, italic, underline, superscript/subscript, numeric/alphabetic/Roman lists, left/right/center/justified alignment, symbols, em dash and nonbreaking spaces/hyphens. Right-to-left text and keyboard operation are supported. Keep rich-text HTML sanitized; reject scripts and untrusted external media fetches during import.

Picture editing supports resize, crop, rotate, flip, drawing, text, brightness/contrast/color adjustments and effects. Keep the original plus an editable operation history and a rendered derivative. Undo and reset must be available. Provide image descriptions for student accessibility.

## Printing and versions

Generate test, answer key, solution document and answer sheet from a shared published version. Print preview and PDF use the same renderer. Support A4/Letter, margins, columns, spacing, answer lines, explicit page breaks, keep-together, title groups, headers/footers, saved presets, background/watermark, horizontal/vertical marks and grouped numbering such as 3.1/3.2/3.3.

If an item cannot fit intact, show an actionable layout warning rather than clipping it. Printable diagram/table/essay regions must leave appropriate response space. Long text, images and multilingual fonts need visual PDF checks.

Randomization supports question order, order within groups, group order and answer choices. Locked choices retain position. Shared stimulus and dependent questions move together. Optional choice selection limits retain correct answers and obey locks; invalid constraints produce an error. Store the actual selection/order for every print version and student attempt. Generate keys from that stored order, including export to external grading tools.

ZipGrade support means using verified supported answer-sheet forms and exporting keys according to ZipGrade's documented format. Provide version-specific keys and question-number mappings. A visually similar custom sheet is insufficient evidence of compatibility. Confirm with real scanning before calling it supported. Smartphone scanning itself remains in ZipGrade.

## Student workflow and grading

Teacher flow: Share → choose availability, time limit, attempts, randomization and feedback timing → Publish → copy link/code. Student accounts are optional; default access uses name/student ID and an optional access code. Explain that entered names identify responses but do not prove identity. Multiple teachers have separate authenticated workspaces.

Student flow: Open link → enter requested identity → review instructions → answer → review unanswered questions → submit → confirmation/results according to teacher settings. No course enrollment is required. Large controls, visible question progress, clear remaining time and keyboard navigation are essential. Drag-and-drop interactions have button/select alternatives.

Persist each answer server-side with visible save status. Temporary connection failures retain pending changes locally and retry, with an honest indication that they are not yet saved. Final submission is idempotent; a retry cannot create another attempt. Server time controls deadlines. A teacher can extend a deadline or grant another attempt. Reloading resumes an active attempt.

Published content is immutable. Editing a draft does not change existing attempts. Never send correct answers, teacher notes, rubrics or hidden key content to a student before the configured release. Objective grading runs on the server; teacher grading and overrides are audited. Provide per-student responses, item analysis and CSV results. Student content requiring manual grading is clearly distinguished from final grades.

## Interchange and migration

Native package: ZIP containing a versioned JSON manifest and local assets, with hashes, schemas, rich text, question structures, grouping, print settings and stable IDs. It must round-trip all supported authoring data. Student attempts/results use a separate backup/export to avoid mixing them into a reusable question package.

GIFT: evaluate gift-parser-ide for friendly diagnostics and gift-pegjs as an alternative. Add a serializer and a tested support matrix; a parser alone is not a complete interchange solution. Escape reserved characters, preserve grades/feedback/categories where representable, and reject or warn about unsupported mappings. Standard GIFT text does not serve as the lossless native format.

QTI: first target QTI 2.1 assessment-item/test packages with a declared supported interaction subset. Validate imported package references and exports against the relevant schemas. Expand to other QTI versions only with explicit adapters and fixtures. Never claim universal QTI compatibility.

Also support Aiken for single-answer multiple choice and a documented CSV/TSV template for simple question data. Moodle XML is a later adapter if demand warrants it.

Schoolhouse .tst: the four recovered version 5 samples are XML with plain text, RTF, typed properties, images and nested collections. First implement read-only migration of verified question types, answer mappings and embedded assets. Preserve unknown fields in the migration record and show conversion warnings. Rich text conversion must be validated; no use of unsafe object deserialization. Native Schoolhouse export and version 6 compatibility are separate work and must not be promised from version 5 samples.

Archive imports enforce file/count/expanded-size limits and safe paths. RTF and HTML are data, never instructions or executable content. Asset references resolve within the import package by default.

## Architecture and boundaries

Proposed implementation: TypeScript browser UI and API with a shared validated domain schema; PostgreSQL; persistent filesystem media behind an asset service; Chromium PDF generation. Choose established rich-text and image-editor libraries after checking capabilities and licenses. Do not reuse proprietary Windows controls.

Modules:

- Question domain and grading: typed structures, validation and scoring independent of UI.
- Bank and test authoring: revisions, snapshots, grouping and metadata.
- Interchange adapters: parsing, mapping, diagnostics and serialization per format.
- Rendering: browser/print views, numbering, version materialization and asset placement.
- Delivery: publication, access, attempts, timing and response persistence.
- Results: grading review, exports and item statistics.
- Infrastructure: teacher authentication, authorization, media, backups and deployment.

The browser calls authenticated APIs for teacher work; student APIs return only public test projections. Each publication stores a frozen test revision. Every attempt stores its concrete version and grading-policy revision. Media serving enforces access to unpublished content and answer assets.

## Delivery sequence

1. Establish the question schema and interchange fixtures, then implement authoring, bank, GIFT/native import-export and version 5 sample migration. First usable slice: multiple choice, true/false, short answer and essay, autosave and readable import reports.
2. Implement shared PDF rendering, layouts, presets, grouping, remaining print question types, picture editing and version-specific keys. Validate ZipGrade integration separately.
3. Implement simple publish/join, saved attempts, timers, objective/manual grading and results. Extend the student renderer to the full supported question model.
4. Complete QTI interchange, advanced randomization and the supplied newer-version features; refine with teacher usability sessions and accessibility checks.

These are implementation phases within the intended scope, not permission to label a four-type prototype feature-complete. Maintain a visible capability matrix through delivery.

## Acceptance and verification

- Native package round trips preserve all supported semantic data and assets.
- GIFT/QTI fixtures include reserved characters, Unicode, feedback, partial credit, categories, malformed files and unsupported interactions. Test with independently produced files and an external consumer, not only the application's own exports.
- All four bundled .tst samples produce a reviewed migration report; key mappings, images and text are checked against source XML. Additional user documents will be needed for wider compatibility.
- Randomization never changes correct-answer identities; concrete version keys match rendered letters and numbers. Locked and shared-stimulus constraints are tested.
- PDF previews have no clipped/overlapping content on long questions, image-heavy pages, groups, tables and page breaks.
- Attempts survive reloads and retryable network failures; deadlines and duplicate submissions are tested server-side.
- Unauthenticated and cross-workspace access tests verify that teacher data and unreleased answer keys are inaccessible.
- Teacher task sessions cover import, editing, print, sharing and result review; student sessions cover joining, navigation, recovery and submission on a phone.
- A clean Docker Compose installation and a backup restore are verified before delivery.

## Evidence and remaining limits

Local-only evidence (not distributed in this repository): see `analysis/findings.md`, `analysis/extracted/manifest.json`, `analysis/sample-schema.json`, and extracted help under `analysis/help`. Static assembly metadata confirms Windows Forms/.NET Framework; application runtime behavior has not been observed. Full managed-member inspection hit REA's representation budget, so no complete code-level reconstruction has been obtained.

The work is functional reconstruction informed by artifact evidence and user requirements. The visual design will be validated with teacher workflows; it will not copy the old application's ribbon layout automatically. Full native file compatibility, real ZipGrade scanning and external QTI interoperability remain validation tasks.
