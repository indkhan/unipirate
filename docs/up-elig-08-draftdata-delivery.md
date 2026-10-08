# UP-ELIG-08 draft data delivery — Pakistan current one-year (future specification)

Mechanical approved-data serialization only. No educational-rule interpretation,
no academic decisions, no new assertions, no source guessing, no aliases,
no frameworks, no dependencies.

## Scope

- Owns ONLY:
  - `docs/spec-data/pakistan-current-one-year.json`
  - `docs/up-elig-08-draftdata-delivery.md` (this file)
- Did NOT touch engine, checker, harness, tests, bootstrap, seed, or any other file.
- No runtime integration, no seed integration, no publication, no merge-gate pass.
- Data status is `future_specification_data` with `executable_coverage: false`.
- Reviewed date recorded as `2026-10-08` (declared value, not a fake execution timestamp).
- No `RuleRecord` / published metadata invented.

## Source contract (verbatim from assignment)

- `source_url`: `https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang`
- `source_quote`: `bei Nachweis von 1 erfolgreichen Studienjahr(en)` (literal, no paraphrase/backtranslation)
- `covered_intakes`: `[4053, 4054, 4055]`
- `evidence_contract`: see JSON field verbatim.
- `discrepancy_url`: `https://www.daad.pk/files/2022/11/Study-in-Germany-Undergraduate-Degree-Courses_2022.pdf`
- `discrepancy_note`: see JSON field verbatim. No formal withdrawal or historical
  commencement asserted; contrary applicable institutional assessments require
  individual confirmation.

## Counts (actual file)

- `common_conditions`: 17 keys (target_degree, curriculum, aps_issuer_country,
  aps_qualification_context, pk_certificate, pk_school_completion, pk_grade_percent,
  pk_prior_study_kind, pk_prior_study_country, pk_prior_study_completion,
  pk_successful_academic_years, pk_study_mode, pk_study_regulations,
  pk_annual_records, pk_reported_recognition, pk_reported_target_relation,
  intake_index).
- `routes`: 3 objects — PAK-BV03/science, PAK-BV02/commerce, PAK-BV01/humanities;
  each `expected_path: subject_restricted`, `expected_institution_restriction: null`.
- `acceptance_cases`: exactly 14 —
  - 3 positive (one per documentary group: grade 50, 1 successful year, intake 4053
    => `subject_restricted`);
  - 3 threshold (one per group: grade 49.99 => `unknown` /
    `threshold_unmet_for_this_route_only`);
  - 1 missing grade (science, `omit: ["pk_grade_percent"]` => `unknown` / `missing_grade`);
  - 1 fractional year (science, 0.5 => `unknown` / `insufficient_successful_years`);
  - 1 unrelated target (science, `reported_official_unrelated` => `unknown` /
    `unrelated_target`);
  - 1 historic intake (science, 4052 => `unknown` / `unreviewed_historical_coverage`);
  - 2 future current (science, 4054 and 4055 => `subject_restricted`);
  - 1 part-time (science, `part_time` => `unknown` / `outside_conservative_coverage`);
  - 1 completed qualification (science, `completed_qualification` => `unknown` /
    `separate_qualification_assessment`).
- Expected-path split: 5 `subject_restricted`, 9 `unknown`.
- `acceptance_cases_note` marks entries as FUTURE unexecuted official expectations,
  not a merge-gate pass; reason strings are specification descriptions, not engine codes.

## Exact checks run

1. Node JSON parse + structural assertions via:
   `C:/Users/mgsuk/AppData/Roaming/fnm/node-versions/v22.23.2/installation/node.exe`
   - `JSON.parse` succeeds.
   - `status == "future_specification_data"`, `executable_coverage == false`,
     `reviewed_on == "2026-10-08"`.
   - `source_url`, `source_quote` exact match.
   - `covered_intakes == [4053,4054,4055]`.
   - `common_conditions` key count 17, `routes` length 3, `acceptance_cases` length 14.
   - No `supabase_url` / `service_role` secret markers.
   - Exit: 0 (`OK status=future_specification_data exec=false routes=3 cases=14 pos=5 unk=9`).
2. `git diff --check` — clean, no whitespace errors. Exit: True (no output).
3. `git status --short` before commit showed only untracked `docs/spec-data/`
   (new JSON) plus this new delivery file; no other working-tree changes.

## Changed files

- `docs/spec-data/pakistan-current-one-year.json` (new)
- `docs/up-elig-08-draftdata-delivery.md` (new)

## Commit

- Branch: `fix/up-elig-08-current-draft-data` (own branch only).
- Scoped commit contains exactly the two owned files above.
- Commit hash: see `git log --oneline -1` after commit (recorded in final session report).

## Session / model

- Model reported: `opencode/muse-spark-1.3-contributor-free`.
- Session ID: unavailable in this environment (no session identifier exposed);
  actual session ID returned where available: none.

## Explicit non-claims

- No tests written, no test coverage claimed, no test suite run for publication.
- No engine/checker/harness/bootstrap coverage; full Pakistan positive coverage is
  activated only by the hard solution owner after implementation.
- No provider, billing, model, ACL, permissions, push, merge, publish, deploy,
  live-DB, or remote paid-provider access.
- No additional research or source changes.
