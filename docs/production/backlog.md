# Production completion backlog — 2026-10-13

Scope: the documented remaining work at the start of this pass, split into 30 independently reviewable outcomes. The target is at least 24 complete outcomes (80%). An outcome is complete only with code and appropriate verification. Partial work is not counted. This percentage measures backlog completion, not production certification.

| # | Outcome | Status | Evidence |
|---|---|---|---|
|1|Container build and launch| Complete | Dockerfile build and constrained Podman launch |
|2|External PostgreSQL application lifecycle| Complete | External PostgreSQL lifecycle smoke test |
|3|Database backup and restore rehearsal| Complete | pg_dump/pg_restore and restored API verification |
|4|Password recovery| Complete | Single-use operator/admin recovery links; regression tests |
|5|Account administration| Complete | Admin-only account list, disable/re-enable and revoked sessions |
|6|Teacher deadline extensions| Complete | Timed active-attempt extensions; ownership and limit tests |
|7|Attempt recovery on another device| Complete | Single-use recovery codes; token rotation and replay tests |
|8|Item statistics| Complete | Graded-only averages and pending counts; API and browser checks |
|9|Spreadsheet question export| Complete | CSV export with limitation review, formula protection and tolerance round trip |
|10|Aiken import| Complete | Aiken parser, file dispatch and invalid-key tests |
|11|Wider GIFT support and consumer testing| Open ||
|12|Wider QTI and external engine testing| Open ||
|13|Broader native migration, RTF and nested types| Open ||
|14|Original import source retention| Complete | Owner-scoped original-source archive; exact-byte retrieval and restore |
|15|Student freehand drawing| Complete | Student freehand canvas; pointer bug fixed, saved and reviewed in browser |
|16|Multiple inline selections| Complete | Per-blank choice sets; privacy/scoring tests and browser submission |
|17|Richer arbitrary table layouts| Open ||
|18|Per-part grading UI| Complete | Individual part marks, validated sums, audit persistence and browser grading |
|19|More image effects| Complete | Invert, vivid colors and soft blur alongside original effects |
|20|Vertical image flip| Complete | Vertical flip exercised with undo/redo in browser |
|21|Multiple movable annotations| Complete | Up to ten separately positioned labels, retained in teacher edit recipe |
|22|Fuller picture edit history| Complete | Bounded 30-edit undo/redo history during an editor session |
|23|Independent intra/inter-group shuffle| Complete | Separate inter-group and intra-group switches; identity/group tests |
|24|Extra title-group templates| Complete | Classic/compact/exam document title templates retained in print presets |
|25|More answer-sheet layouts| Complete | Standard/compact/lined answer sheets |
|26|Server PDF generation| Complete | Owner-scoped Chromium PDF route; container/local generation verified |
|27|Multi-page print verification| Complete | 45-question A4/Letter PDFs in one/two columns, exact text presence and visual review |
|28|Automated overflow reports| Complete | Horizontal and oversized-block reports; normal and deliberately oversized fixtures |
|29|Real ZipGrade import/scanning| Open ||
|30|Representative teacher/student usability and accessibility testing| Open ||

Production release gates additionally require safe authentication/proxy configuration, bounded resource use, graceful shutdown, deployment health checks, automated CI and meaningful regression coverage. A completed checklist does not stand in for field validation.

Completed: **24/30 outcomes (80%)**. Open: 11, 12, 13, 17, 29 and 30. Image history is intentionally bounded to an editor session; full cross-session history remains a future extension. The table describes implemented outcomes precisely so these bounded features are not mistaken for full parity.
