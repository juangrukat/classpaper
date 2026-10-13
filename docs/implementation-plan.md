# Implementation sequence and status

The user approved the written design and the normal-plan fallback for the unavailable writing-plans skill.

## Completed first implementation pass
- Shared typed question/answer schema and validation.
- Persistent local PostgreSQL-compatible development storage and external PostgreSQL adapter.
- Teacher sessions, owner-scoped APIs, immutable publications and token-protected attempts.
- Teacher UI, question bank, import review, print views, student flow and teacher grading.
- GIFT/CSV/native adapters and partial Schoolhouse migration.
- Meaningful domain/interchange and API integration tests.
- Dockerfile, Compose configuration and run documentation.

## Remaining delivery work
The intended product is not complete. See `app/README.md` for the exact implemented capability matrix and remaining features. Next build the remaining question types and rich text, then QTI and advanced print layouts; validate ZipGrade and Docker/PostgreSQL deployment independently. Preserve the teacher usability requirement throughout.

## Additional implementation completed

The same pass now includes all 17 baseline editors, rich text/lists/justification/symbols, private original pictures and reusable edit recipes, picture drawing/text/effects, saved print presets, decimal numbering, choice limits, page breaks/spacing/backgrounds, grade audit, persistent print versions, CSV column mapping, bounded QTI 2.1 and ZipGrade key CSV. The remaining-work matrix is maintained in `app/README.md`; earlier phase bullets above are a history of the first pass, not the final capability list.
