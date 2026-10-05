# Feature verification ? 5 October 2026

## Outcome

Audited the existing routes, actions, pure logic, database permissions and operational scripts. Ran the local app at http://localhost:3001 against the linked Supabase project, using temporary student, second-student and admin accounts. Fixed reproduced defects in separate local commits. No new product features, push or application deployment was performed.

The exercised deterministic workflows pass. Successful AI behavior remains blocked by exhausted provider quota and missing KB embeddings. This is an engineering check, not independent verification of educational source facts or every possible university page format.

## Feature coverage

| Existing feature | Evidence and result |
| --- | --- |
| Landing page and country entry | Browser navigation and render tests; source-first copy and checker entry work. |
| Anonymous checker | Browser validation, branching and persisted progress; national-board, GCE, IB and master's profiles exercised. Pure engine/edge-case tests cover supported qualification cases and honest unknowns. |
| Results and sharing | Browser copy-link and generated WhatsApp/Telegram destinations; no messages sent. Result rendering recomputes from validated answers/current rules. Database tests cover private ownership tokens and UUID-scoped sharing. |
| Authentication | Password login/sign-out and anonymous result claim exercised. Real Supabase-generated signup, magic-link and recovery tokens establish sessions and correct redirects. Browser reset and subsequent new-password authentication pass. Google provider redirects to Google; full consent/login and email delivery are unverified. |
| Profile | Browser saves/re-evaluates national, GCE and IB answers; switching qualification removes irrelevant fields. Master's missing coverage returns explicit unknowns. |
| Course finder | Browser search, city filtering, empty results and approved-course tracking; filters and cards reviewed in code. |
| Course import | Actual DAAD page copied/pasted, tab sections combined, duplicate URLs checked, pending privacy and admin approval exercised. See [catalogue verification](CATALOGUE_VERIFICATION.md). AI fallback's successful extraction is unverified; unit tests reject facts absent from pasted text. |
| Public course detail | Source facts, saved task edits and admin-update decisions exercised in browser; permissions tested against live database. |
| Dashboard and applications | Add/remove and status changes exercised; submitted/admitted/rejected states hide pending course tasks while retaining progress. Returning to planning restores them. |
| Manual tasks and buckets | Browser create, notes-only edit, complete/undo, delete and drag to Later; bucket choice persists after reload. |
| Calendar | Dated task appears on its date; day selection and next-month empty state work. Undated source statements stay verbatim without invented dates. |
| Admin reviews | Approve/reject, source facts/task edits and conflict adoption exercised. Live tests verify both conflict decisions preserve applications, IDs, completions and personal edits. |
| Admin rules | Browser edit/re-verify, country/status/search filters; invalid filters handled by tested URL parser. Source facts were not rewritten. |
| Admin course tasks | Browser custom task create, fixed-date to no-date change, source-change adoption, unchanged resave, retire, student keep-mine and conversion to personal task. Pure/live tests cover update/adopt/remove permissions and progress. |
| Admin overview/audit | Navigation and consequential changes appear in audit history. Student/anonymous admin restrictions verified. |
| Theme and responsive layout | Theme toggle/storage/navigation exercised. Earlier 390px dashboard/admin checks reproduced and verified long-URL overflow fix. |
| Assistant | UI request/error path and question logging exercised. Unit tests cover request validation, quota, prompt constraints, markers and forged tool evidence. Live tests cover message privacy. Successful RAG/tool answers and the 20-question behavioral evaluation cannot be certified while the provider is blocked. |
| Seed/types/build tools | All 25 bootstrap candidates validate without database writes; no draft rules were added. Applied migrations/types described below. Production build, tests, lint and typecheck pass. |
| KB embedding | Actual rebuild stops at provider quota without changing the 48 existing rows. Regression test verifies failed vector writes cannot erase the existing corpus. |

## Fixes committed

Each fix has its own local commit, with focused regression coverage where appropriate:

- Repair stale test harnesses/profile fixtures and the assistant evaluation profile.
- Restrict check-table collection access and insertion to trusted server code; recompute saved results from validated answers.
- Reject browser system prompts and forged tool evidence; remove unsupported example/coverage claims from assistant prompts.
- Hide outstanding course tasks outside planning status and refresh dashboard cards when notes/source/admin state change.
- Contain long admin source URLs and reset the import sheet after adding an existing course.
- Parse current DAAD labels and full source sections; discard AI-extracted strings absent from the pasted source.
- Compare source snapshots independently of JSON key order and resolve canonical duplicate-course lookups.
- Preserve original course IDs, applications and task progress during conflict resolution.
- Preserve intended destinations after auth-link failure and avoid repeat update prompts after students keep their edits.
- Preserve the KB when replacement embedding writes fail.
- Clear obsolete fixed dates when an admin changes due mode; show undated deadline statements instead of claiming they are missing.
- Return a retryable checker error on persistence failure and retain selected admin rule-country filters.

## External limitations and data coverage

1. **AI provider:** OpenRouter authenticates but returns HTTP 429, `free-models-per-day`, with remaining quota zero. Chat, AI import fallback and KB embedding were attempted. A successful behavioral evaluation remains pending; provider failure is not a passing assistant evaluation.
2. **Knowledge base:** 48 KB text rows remain, with empty embeddings after the previously applied 2048-dimensional migration. The old 1536-dimensional vectors are backed up under ignored `test-results/kb-backup-20261002.json`. Rebuild with available provider quota before relying on retrieval.
3. **Rule coverage:** 34 live rules include 30 published verified records and four drafts. Ten published records reference unsupported checker/derived facts and are skipped by schema validation, producing honest unknowns. Supporting those cases would require additional product questions and source review, outside this fixes-only request. The exercised Indian rules contain no task steps; no draft tasks were published.
4. **Authentication/analytics:** Real confirmation/reset endpoints work, but inbox delivery and full Google sign-in are unverified. The configured PostHog placeholder `phc_xxx` returns 404/401; analytics is not verified with that configuration.
5. **Deployment:** Check-access and conflict-preservation migrations were applied to the linked database; types were regenerated. Application changes are local commits. Any deployed app needs the matching code to use the updated database behavior.

UUID holders can view shared answers under the existing sharing design. Expiration/revocation and other unimplemented product work remain in the [backlog](UNIPIRATE_IMPLEMENTATION_BACKLOG.md); they were not added during this audit.

### Published rules skipped by schema validation

| Rule slug | Unsupported facts |
| --- | --- |
| `sa-bachelor-master-unknown` | `prior_degree_years` |
| `in-70pct-grandfathered-aps-unknown` | `aps_application_day` |
| `in-1yr-bachelor-70pct-subject-restricted` | `years_of_university_study`, `university_study_field_matches_target`, `university_study_institution_recognized` |
| `dmat-india-ss2027-scope` | `prior_degree_field`, `partnership_program`, `aps_registration_day`, `aps_documents_shipped_day` |
| `dmat-india-partnership-exempt` | `partnership_program` |
| `dmat-india-registration-transition-exempt` | `aps_registration_day` |
| `dmat-india-shipment-transition-exempt` | `aps_documents_shipped_day` |
| `dmat-india-unaffected-field` | `prior_degree_field` |
| `sa-1yr-university-studienkolleg` | `years_of_university_study`, `school_certificate_requirements_met`, `university_study_field_matches_target`, `university_study_institution_recognized` |
| `sa-2yr-university-subject-restricted` | `years_of_university_study`, `school_certificate_requirements_met`, `university_study_field_matches_target`, `university_study_institution_recognized` |

## Final verification and cleanup

- `pnpm test`: **222 passing tests in 34 files**, including **26 live database tests**, with no skips.
- `pnpm lint`: pass, no warnings.
- `pnpm typecheck`: pass.
- `pnpm build`: pass; all existing routes compile.
- Production server smoke check: public pages return 200, missing results return 404, protected pages redirect to login, and anonymous API requests return 401.
- All three temporary QA accounts, their checks, applications/tasks, imported course versions, synthetic rule and audit records removed. Temporary credentials/scripts removed from the workspace.
- The original catalogue retains its two approved courses and one pending course, with original IDs and review statuses. Existing educational facts were not intentionally changed.

Changes are committed locally, one defect at a time, followed by a documentation commit. Nothing was pushed or deployed.
