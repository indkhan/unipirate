// TEST ONLY: simulated human publication, never admin approval or a DB write.
// Fixed assignments are independent of candidate order; no policy matching here.
import { EngineRuleSchema } from '../evaluate';
import { RuleVersionSchema, type RuleVersion } from '@/lib/rules/versioning';
import { ENGINE_REVISION } from '@/lib/rules/current';

export const FINAL_BASE_SHA = '53e75f58242ab7168b7354b375a9116204b29f56';
export const TEST_CONTEXT = { evaluatedAt: '2026-10-08T12:00:00Z', engineRevision: ENGINE_REVISION };
export const TEST_PUBLICATION_AT = '2026-10-08T11:00:00Z';
export const TEST_REVIEWER = '30000000-0000-4000-8000-000000000001';
const assignments: Record<string, string> = {
  "gce-technical-subject-restricted": "000000000001",
  "gce-technical-subject-restricted-cambridge": "000000000002",
  "gce-social-economics-subject-restricted": "000000000003",
  "gce-social-economics-subject-restricted-cambridge": "000000000004",
  "gce-humanities-subject-restricted": "000000000005",
  "gce-humanities-subject-restricted-cambridge": "000000000006",
  "gce-science-subject-restricted": "000000000007",
  "gce-science-subject-restricted-cambridge": "000000000008",
  "gce-medicine-pharmacy-subject-restricted": "000000000009",
  "gce-medicine-pharmacy-subject-restricted-cambridge": "00000000000a",
  "gce-arts-subject-restricted": "00000000000b",
  "gce-arts-subject-restricted-cambridge": "00000000000c",
  "ib-reviewed-2025-math-hl-ordinary-grades": "00000000000d",
  "ib-reviewed-2025-math-sl-annex-ordinary-grades": "00000000000e",
  "ib-reviewed-2025-math-sl-subject-scope-ordinary-grades": "00000000000f",
  "ib-reviewed-2025-math-hl-compensated-grade3": "000000000010",
  "ib-reviewed-2025-math-sl-annex-compensated-grade3": "000000000011",
  "ib-reviewed-2025-math-sl-subject-scope-compensated-grade3": "000000000012",
  "ib-reviewed-2021-2024-math-hl-ordinary-grades": "000000000013",
  "ib-reviewed-2021-2024-math-sl-annex-ordinary-grades": "000000000014",
  "ib-reviewed-2021-2024-math-sl-subject-scope-ordinary-grades": "000000000015",
  "ib-reviewed-2021-2024-math-hl-compensated-grade3": "000000000016",
  "ib-reviewed-2021-2024-math-sl-annex-compensated-grade3": "000000000017",
  "ib-reviewed-2021-2024-math-sl-subject-scope-compensated-grade3": "000000000018",
  "ib-reviewed-through2020-legacy-mathematics-ordinary-grades": "000000000019",
  "ib-reviewed-through2020-legacy-mathematics-compensated-grade3": "00000000001a",
  "ib-reviewed-document-not_awarded": "00000000001b",
  "ib-reviewed-document-certificate": "00000000001c",
  "ib-reviewed-document-unknown": "00000000001d",
  "india-study-successful-year": "00000000001e",
  "india-study-school-only": "00000000001f",
  "india-study-review-kind": "000000000020",
  "india-study-review-country": "000000000021",
  "india-study-review-mode": "000000000022",
  "india-study-review-years-missing": "000000000023",
  "india-study-review-years-unmet": "000000000024",
  "india-study-review-recognition-rejected": "000000000025",
  "india-study-review-recognition-missing": "000000000026",
  "india-study-review-relation-unrelated": "000000000027",
  "india-study-review-relation-missing": "000000000028",
  "india-study-review-missing-class12_percent": "000000000029",
  "india-study-review-missing-intake_index": "00000000002a",
  "india-study-review-missing-aps_issuer_country": "00000000002b",
  "india-study-review-missing-aps_qualification_context": "00000000002c",
  "pakistan-prep-science": "00000000002d",
  "pakistan-prep-commerce": "00000000002e",
  "pakistan-prep-humanities": "00000000002f",
  "pakistan-review-completed_qualification": "000000000030",
  "pakistan-review-other": "000000000031",
  "pakistan-review-unknown": "000000000032",
  "pakistan-master-review": "000000000033",
  "pakistan-current-year-science": "000000000034",
  "pakistan-current-brochure-science": "000000000035",
  "pakistan-current-year-commerce": "000000000036",
  "pakistan-current-brochure-commerce": "000000000037",
  "pakistan-current-year-humanities": "000000000038",
  "pakistan-current-brochure-humanities": "000000000039",
  "pakistan-study-evidence-review": "00000000003a",
  "sa-reviewed-private-one": "00000000003b",
  "sa-reviewed-private-two": "00000000003c",
  "sa-reviewed-industrial-enrollment": "00000000003d",
  "sa-reviewed-industrial-year": "00000000003e",
  "sa-reviewed-national-literary-prep": "00000000003f",
  "sa-reviewed-national-literary-year": "000000000040",
  "sa-reviewed-national-science-prep": "000000000041",
  "sa-reviewed-national-science-year": "000000000042",
  "sa-reviewed-national-commercial-prep": "000000000043",
  "sa-reviewed-national-commercial-year": "000000000044",
  "sa-reviewed-completed-bachelor": "000000000045",
  "dmat-reviewed-before-intake": "000000000046",
  "dmat-reviewed-review": "000000000047",
  "dmat-reviewed-multiple-review": "000000000048",
  "dmat-reviewed-completed": "000000000049",
  "dmat-reviewed-registration-before": "00000000004a",
  "dmat-reviewed-dispatch-before": "00000000004b",
  "dmat-reviewed-partnership": "00000000004c",
  "dmat-reviewed-unaffected": "00000000004d",
  "dmat-reviewed-enrolled-3": "00000000004e",
  "dmat-reviewed-enrolled-4": "00000000004f",
  "dmat-reviewed-required-0-0-0-0": "000000000050",
  "dmat-reviewed-required-0-0-0-1": "000000000051",
  "dmat-reviewed-required-0-0-1-0": "000000000052",
  "dmat-reviewed-required-0-0-1-1": "000000000053",
  "dmat-reviewed-required-0-0-2-0": "000000000054",
  "dmat-reviewed-required-0-0-2-1": "000000000055",
  "dmat-reviewed-required-0-1-0-0": "000000000056",
  "dmat-reviewed-required-0-1-0-1": "000000000057",
  "dmat-reviewed-required-0-1-1-0": "000000000058",
  "dmat-reviewed-required-0-1-1-1": "000000000059",
  "dmat-reviewed-required-0-1-2-0": "00000000005a",
  "dmat-reviewed-required-0-1-2-1": "00000000005b",
  "dmat-reviewed-required-1-0-0-0": "00000000005c",
  "dmat-reviewed-required-1-0-0-1": "00000000005d",
  "dmat-reviewed-required-1-0-1-0": "00000000005e",
  "dmat-reviewed-required-1-0-1-1": "00000000005f",
  "dmat-reviewed-required-1-0-2-0": "000000000060",
  "dmat-reviewed-required-1-0-2-1": "000000000061",
  "dmat-reviewed-required-1-1-0-0": "000000000062",
  "dmat-reviewed-required-1-1-0-1": "000000000063",
  "dmat-reviewed-required-1-1-1-0": "000000000064",
  "dmat-reviewed-required-1-1-1-1": "000000000065",
  "dmat-reviewed-required-1-1-2-0": "000000000066",
  "dmat-reviewed-required-1-1-2-1": "000000000067",
  "aps-transition-before": "000000000068",
  "aps-transition-current": "000000000069",
  "aps-transition-unconfirmed": "00000000006a",
  "aps-scoped-qualification": "00000000006b",
  "aps-scoped-application": "00000000006c",
  "aps-scoped-visa-sa": "00000000006d",
  "aps-scoped-acquisition": "00000000006e",
  "in-jee-qualifying-pass-review": "00000000006f",
  "df155c8a-8522-459b-b572-51033b93492d": "000000000070",
  "8d95fa83-385f-4863-88cc-7dfe0a3036c6": "000000000071",
  "f787cf74-25be-48db-b20f-2382d4baeb83": "000000000072",
  "c29d930a-87c9-49ba-8e30-b764e42760ca": "000000000073",
  "1cb0cf24-8f39-44b4-b692-b9cb164e47fd": "000000000074",
  "0e872b82-e7fb-41bb-9a35-53ecbe200df4": "000000000075",
  "dmat-bachelor-not-required": "000000000076",
  // Synthetic APS resolver control only; never an official candidate.
  "up-test-01-synthetic-aps-application-conflict": "000000000077"
};
export const publicationIdentity = (id: string) => {
  const suffix = assignments[id];
  if (!suffix) throw new Error('Unassigned reviewed source: ' + id);
  return { ruleId: '10000000-0000-4000-8000-' + suffix, versionId: '20000000-0000-4000-8000-' + suffix };
};
export function originalIdentity(uuid: string): string {
  const entry = Object.keys(assignments).find(id => publicationIdentity(id).ruleId === uuid);
  if (!entry) throw new Error('Unbound logical UUID: ' + uuid);
  return entry;
}
// Existing reviewed Pakistan envelope only. No verification-to-commencement inference.
const scopedPakistan = new Set([
  'pakistan-current-year-science', 'pakistan-current-brochure-science',
  'pakistan-current-year-commerce', 'pakistan-current-brochure-commerce',
  'pakistan-current-year-humanities', 'pakistan-current-brochure-humanities',
]);
export function simulatedPublication(rules: readonly { id: string; status: string; [key: string]: unknown }[]): RuleVersion[] {
  return rules.map(rule => {
    const identity = publicationIdentity(rule.id);
    const raw = rule as { id: string } & { slug?: string; country?: string | null; country_code?: string | null; notes?: string | null; created_at?: string; updated_at?: string };
    const snapshot = {
      ...structuredClone(rule), id: identity.ruleId, status: 'verified',
      slug: raw.slug ?? rule.id, country_code: raw.country_code ?? raw.country ?? null,
      notes: raw.notes ?? null, created_at: raw.created_at ?? TEST_PUBLICATION_AT,
      updated_at: raw.updated_at ?? TEST_PUBLICATION_AT,
    };
    return RuleVersionSchema.parse({
      id: identity.versionId, rule_id: identity.ruleId, version_number: 1,
      supersedes_version_id: null, raw_snapshot: snapshot, status: 'verified',
      effective_from: null, effective_until: null,
      intake_from: scopedPakistan.has(rule.id) ? 4053 : null,
      intake_until: scopedPakistan.has(rule.id) ? 4056 : null,
      reviewed_by: TEST_REVIEWER, reviewed_at: TEST_PUBLICATION_AT,
      published_at: TEST_PUBLICATION_AT, captured_at: null, draft_revision: 1,
      provenance: 'human_publication',
    });
  });
}
export function selectedRule(version: RuleVersion) {
  return EngineRuleSchema.parse(version.raw_snapshot);
}
