import {describe, expect, it} from "vitest";
import {deriveFacts, evaluate, isScopedJeePathRule, type Profile} from "../evaluate";
import {ruleData} from "@/scripts/rules.bootstrap";
import {indianStudyProfile, reviewedIndiaStudyRules} from "./india-study.fixture";
const candidate = () => ruleData.find(r => r.id === "in-jee-qualifying-pass-review")!;
const published = () => ({...candidate(), status: "verified" as const});
export const ordinary: Profile = {targetDegree:"bachelor",curriculumType:"national",certificateCountry:"in",
 schoolQualification:{country:"in",context:"national"},targetField:"mechanical_engineering",intake:{term:"winter",year:2026},
 jee:{main:"passed",advanced:"passed",context:"ordinary",schoolCertificate:"completed_12_year_secondary",
 targetFamily:"reported_official_technology",targetFamilyReference:"University assessment for this intended programme: technology."}};
describe("UP-ELIG-04 source-backed ordinary draft copies",()=>{
 it("source-backed draft grants nothing; disposable published copy grants only subject restriction",()=>{
 expect(candidate().status).toBe("draft");expect(evaluate(ordinary,[candidate()]).path).toBe("unknown");
 const r=evaluate(ordinary,[published()]);expect(r.path).toBe("subject_restricted");
 expect(r.citations[0]).toMatchObject({sourceUrl:"https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=4&ad-layerId=63",verifiedAt:"2026-10-08T00:00:00Z"});
 expect(r.citations[0].claim).toMatch(/reported/);expect(r.citations[0].claim).toMatch(/institution/);
 });
 it.each(["reported_official_technology","reported_official_natural_sciences"] as const)("reported family %s",targetFamily=>expect(evaluate({...ordinary,jee:{...ordinary.jee!,targetFamily}},[published()]).path).toBe("subject_restricted"));
 it.each([69.99,70,70.01,undefined])("percentage %s does not alter JEE",schoolGradePercent=>expect(evaluate({...ordinary,schoolGradePercent},[published()]).path).toBe("subject_restricted"));
 it.each([{term:"winter",year:2026},{term:"summer",year:2027},{term:"winter",year:2027}] as const)("exact covered intake %j",intake=>expect(evaluate({...ordinary,intake},[published()]).path).toBe("subject_restricted"));
 it.each([{term:"summer",year:2026},{term:"summer",year:2028},undefined] as const)("noncovered intake %j",intake=>{const r=evaluate({...ordinary,intake},[published()]);expect(r.path).toBe("unknown");expect(r.unknowns.join(" ")).toMatch(/intake/);});
 it.each(["main","advanced"] as const)("every nonpass or missing %s excludes only JEE",exam=>{for(const status of ["not_passed","no_result","unknown",undefined] as const)expect(evaluate({...ordinary,jee:{...ordinary.jee!,[exam]:status}},[published()]).path).toBe("unknown");});
 it.each(["main_exemption","preparatory_rank","cross_year","unclear",undefined] as const)("context %s",context=>expect(evaluate({...ordinary,jee:{...ordinary.jee!,context}},[published()]).path).toBe("unknown"));
 it.each(["other","unknown",undefined] as const)("certificate %s",schoolCertificate=>expect(evaluate({...ordinary,jee:{...ordinary.jee!,schoolCertificate}},[published()]).path).toBe("unknown"));
 it.each(["unknown","reported_official_outside",undefined] as const)("family %s",targetFamily=>expect(evaluate({...ordinary,jee:{...ordinary.jee!,targetFamily}},[published()]).path).toBe("unknown"));
 it.each([undefined,"","   ","x".repeat(501)])("invalid classification reference %j",targetFamilyReference=>expect(evaluate({...ordinary,jee:{...ordinary.jee!,targetFamilyReference}},[published()]).path).toBe("unknown"));
 it.each(["cs","engineering","biology","law",undefined])("target label %s alone is no official classification",targetField=>expect(evaluate({...ordinary,targetField,jee:{...ordinary.jee!,targetFamily:undefined}},[published()]).path).toBe("unknown"));
 it("requires a target for reference applicability",()=>expect(evaluate({...ordinary,targetField:undefined},[published()]).path).toBe("unknown"));
 it.each([{country:"pk",context:"national"},{country:"in",context:"international"},{country:"in",context:"unknown"},undefined] as const)("issuer %j yields no JEE facts or path",schoolQualification=>{const p={...ordinary,schoolQualification};expect(deriveFacts(p)).not.toHaveProperty("jee_reported_target_family");expect(evaluate(p,[published()]).path).toBe("unknown");});
 it("foreign issuer hides retained India JEE evidence and diagnostics",()=>{const r=evaluate({...ordinary,schoolQualification:{country:"pk",context:"national"}},[published()]);expect(r.citations).toEqual([]);expect(r.unknowns.join(" ")).not.toMatch(/JEE|12-year|technology/);});
 it("legacy bool and numeric malformed status cannot supply new facts",()=>{expect(evaluate({...ordinary,jee:undefined,jeeAdvanced:true},[published()]).path).toBe("unknown");expect(evaluate({...ordinary,jee:{...ordinary.jee!,main:99}} as unknown as Profile,[published()]).path).toBe("unknown");});
 it("requires category/family/exact-intake metadata and never authorizes exclusion-only scope",()=>{const r=published();expect(isScopedJeePathRule(r)).toBe(true);for(const key of ["jee_school_certificate","jee_reported_target_family","intake_index"]){const conditions={...r.conditions};delete conditions[key as keyof typeof conditions];expect(isScopedJeePathRule({...r,conditions})).toBe(false);expect(isScopedJeePathRule({...r,conditions:{...r.conditions,[key]:{op:"neq",value:"unknown"}}})).toBe(false);}});
 it("equal-specificity contradictory current path rules stay unknown with both citations",()=>{const r=published();const x={...r,id:"other-route",conditions:{target_degree:"bachelor",curriculum:"national",aps_issuer_country:"in",aps_qualification_context:"national",jee_school_certificate:"completed_12_year_secondary",jee_main_status:"passed",jee_advanced_status:"passed",jee_evidence_context:"ordinary",jee_reported_target_family:{op:"in",value:["reported_official_technology","reported_official_natural_sciences"]},intake_index:{op:"in",value:[4053,4054,4055]}},outcomes:{path:"unknown"}};const result=evaluate(ordinary,[r,x]);expect(result.path).toBe("unknown");expect(result.unknowns.join(" ")).toMatch(/Conflicting rules/);expect(result.citations).toHaveLength(2);});
 it.each([69.99,70,70.01,undefined])("independent India03 rules do not impose their percentage on JEE %s",schoolGradePercent=>expect(evaluate({...ordinary,schoolGradePercent},[...reviewedIndiaStudyRules(),published()]).path).toBe("subject_restricted"));
 it.each([{targetDegree:"master"},{curriculumType:"ib"},{curriculumType:"gce"}] as const)("other qualification scope %j cannot supply JEE facts",scope=>{const p={...ordinary,...scope} as Profile;expect(deriveFacts(p)).not.toHaveProperty("jee_main_status");expect(evaluate(p,[published()]).path).toBe("unknown");});
 it("nationality/visa independent; failed or missing JEE retains India03 alternative",()=>{expect(evaluate({...ordinary,nationality:"pk",visaApplicationCountry:"sa"},[published()]).path).toBe("subject_restricted");for(const jee of [undefined,{main:"not_passed",advanced:"no_result"} as const])expect(evaluate({...indianStudyProfile,jee},reviewedIndiaStudyRules()).path).toBe("subject_restricted");});
});
