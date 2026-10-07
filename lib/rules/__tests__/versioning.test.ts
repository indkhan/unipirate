import { describe, expect, it } from "vitest";
import { EngineRuleSchema, evaluate, type Profile } from "@/lib/engine/evaluate";
import { selectRuleVersions, meaningfulRuleDiff, previewRuleImpact, assessmentDateUtc } from "../versioning";
const ruleId = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
const raw = { id: ruleId, slug: "synthetic", country_code: null, conditions: {}, outcomes: { path: "direct" }, status: "verified", source_url: "https://example.invalid/source", source_quote: " Synthetic quote ", last_verified_at: "2026-01-01T00:00:00Z", notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
function version(n: number, extra = {}) { return { id: "00000000-0000-4000-8000-" + String(n + 10).padStart(12,"0"), rule_id: ruleId, version_number: n, supersedes_version_id: null, raw_snapshot: raw, status: "verified", effective_from: null, effective_until: null, intake_from: null, intake_until: null, reviewed_by: actor, reviewed_at: "2026-01-02T00:00:00Z", published_at: "2026-01-02T00:00:00Z", captured_at: null, draft_revision: 1, provenance: "human_publication", ...extra }; }
const context = { assessmentDate: "2026-10-07", intake: { term: "winter" as const, year: 2026 } };
describe("immutable rule selection", () => {
 it("selects replacement before matching and never revives a predecessor", () => {
  const result = selectRuleVersions([version(1), version(2,{ raw_snapshot: {...raw, conditions: { target_degree: "master" } } })],context);
  expect(result.selected.map(x=>x.version.version_number)).toEqual([2]);
  const profile: Profile = { targetDegree: "bachelor", curriculumType: "other" };
  expect(evaluate(profile,result.selected.map(x=>x.rule)).path).toBe("unknown");
  expect(result.selected[0].rule.id).toBe(ruleId);
 });
 it.each([["2026-09-30",1],["2026-10-01",2],["2026-10-31",2],["2026-11-01",1]])("assessment half-open boundary %s selects %s", (assessmentDate,n) => {
  expect(selectRuleVersions([version(1),version(2,{effective_from:"2026-10-01",effective_until:"2026-11-01"})],{...context,assessmentDate}).selected[0].version.version_number).toBe(n);
 });
 it.each([[{term:"summer",year:2026},1],[{term:"winter",year:2026},2],[{term:"summer",year:2027},1]])("intake half-open boundary %j selects %s", (intake,n) => {
  expect(selectRuleVersions([version(1),version(2,{intake_from:4053,intake_until:4054})],{...context,intake}).selected[0].version.version_number).toBe(n);
 });
 it("missing discriminating intake blocks fallback with an honest diagnostic", () => {
  const result=selectRuleVersions([version(1),version(2,{intake_from:4053})],{assessmentDate:context.assessmentDate});
  expect(result.selected).toEqual([]); expect(result.diagnostics[0].reason).toBe("missing_intake");
 });
 it("ignores future versions before status and raw schema inspection", () => {
  const result=selectRuleVersions([version(1),version(2,{effective_from:"2027-01-01",status:null,raw_snapshot:null})],context);
  expect(result.selected[0].version.version_number).toBe(1); expect(result.diagnostics).toEqual([]);
 });
 it("unknown legacy bounds never authenticate a positive legacy outcome", () => {
  const result=selectRuleVersions([version(1,{provenance:"legacy_capture",reviewed_by:null,reviewed_at:null,published_at:null,draft_revision:null,captured_at:"2026-10-07T00:00:00Z"})],context);
  expect(result.selected).toEqual([]); expect(result.diagnostics[0].reason).toBe("legacy_scope_unknown");
 });
 it.each([{status:null},{reviewed_by:null},{raw_snapshot:{...raw,last_verified_at:null}},{raw_snapshot:{...raw,source_quote:""}}])("does not fallback when newest applicable publication is invalid: %j", extra => {
  const result=selectRuleVersions([version(1),version(2,extra)],context);
  expect(result.selected).toEqual([]); expect(result.diagnostics[0].reason).toBe("invalid_publication");
 });
 it("rejects impossible assessment dates instead of rolling them over", () => expect(()=>selectRuleVersions([],{assessmentDate:"2026-02-30"})).toThrow());
});
describe("meaningful publication diff", () => {
 const before={raw_snapshot:raw,effective_from:null,effective_until:null,intake_from:null,intake_until:null,status:"verified"};
 it("ignores object key order",()=>expect(meaningfulRuleDiff(before,{...before,raw_snapshot:{...raw,conditions:{}}})).toEqual([]));
 it.each(["source_url","source_quote","last_verified_at","conditions","outcomes","notes"]) ("exposes %s changes", key => {
  expect(meaningfulRuleDiff(before,{...before,raw_snapshot:{...raw,[key]:key==="conditions"?{target_degree:"master"}:key==="outcomes"?{steps:["literal"]}:"changed"}}).length).toBeGreaterThan(0);
 });
 it("preserves array order and literal whitespace",()=>{
  expect(meaningfulRuleDiff({...before,raw_snapshot:{...raw,outcomes:{documents:["a","b"]}}},{...before,raw_snapshot:{...raw,outcomes:{documents:["b","a"]}}})).not.toEqual([]);
  expect(meaningfulRuleDiff(before,{...before,raw_snapshot:{...raw,source_quote:"Synthetic quote"}})).not.toEqual([]);
 });
 it("shows status and scope",()=>expect(meaningfulRuleDiff(before,{...before,status:"beta",intake_from:4053})).toEqual(expect.arrayContaining([expect.objectContaining({field:"status"}),expect.objectContaining({field:"intake_from"})])));
});

it("object order is benign at every nested level",()=>{
 const scope={effective_from:null,effective_until:null,intake_from:null,intake_until:null,status:"verified"};
 const a={raw_snapshot:{conditions:{target_degree:"bachelor",class12_percent:{op:"gte",value:70}},outcomes:{documents:["a","b"],path:"direct"}},...scope};
 const b={...scope,raw_snapshot:{outcomes:{path:"direct",documents:["a","b"]},conditions:{class12_percent:{value:70,op:"gte"},target_degree:"bachelor"}}};
 expect(meaningfulRuleDiff(a,b)).toEqual([]);
});

it("assessment instant is converted to UTC date without any applicant-event alias",()=>{expect(assessmentDateUtc("2026-10-07T00:30:00+02:00")).toBe("2026-10-06");expect(()=>assessmentDateUtc("bad")).toThrow();});
it("impact includes new coverage with no old match and never mutates supplied profiles/rules",()=>{
 const profile:Profile={targetDegree:"bachelor",curriculumType:"other"};const rule=EngineRuleSchema.parse({...raw,status:"verified"});
 const input=[{before:{profile,rules:[]},after:{profile,rules:[rule]}}];const original=JSON.stringify(input);
 expect(previewRuleImpact(input)).toEqual({changed:1,newCoverage:1});expect(JSON.stringify(input)).toBe(original);
 expect(previewRuleImpact([{before:{profile,rules:[rule]},after:{profile,rules:[rule]}}])).toEqual({changed:0,newCoverage:0});
});

it("legacy null scope differs from explicitly reviewed unbounded publication",()=>{const before=version(1,{provenance:"legacy_capture"});const after=version(2);expect(meaningfulRuleDiff(before,after)).toEqual(expect.arrayContaining([expect.objectContaining({field:"scope_review",before:"unknown historical scope",after:"explicitly reviewed bounds"})]));});
