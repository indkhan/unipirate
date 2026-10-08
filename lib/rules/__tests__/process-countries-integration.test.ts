import {expect,it} from "vitest";
import {AnswersSchema,buildProfile,withProcessContext} from "@/app/(public)/check/steps";
import {saudiAnswers} from "@/app/(public)/check/__tests__/saudi.fixture";
import {currentPakistanAnswers} from "@/app/(public)/check/__tests__/pakistan-current.fixture";
import {saudiCandidates} from "@/scripts/saudi.rules";
import {pakistanCandidates} from "@/scripts/pakistan.rules";
import {processCandidates} from "@/scripts/process.rules";
import {evaluateAssessment,compareAssessments} from "../assessment";
import {selectedKnowledge} from "@/lib/ai/versioned-kb";
import {version} from "./assessment-fixtures";
const now="2026-10-08T12:00:00Z";
const context={evaluatedAt:now,engineRevision:"test/combined-source-candidates"};
// Actual draft definitions in synthetic immutable UUID envelopes; no publication.
const versions=[...saudiCandidates,...pakistanCandidates,...processCandidates].map((candidate,i)=>{const id="00000000-0000-4000-8000-"+String(i+1000).padStart(12,"0");return version(i+1,{rule_id:id,reviewed_at:now,published_at:now,raw_snapshot:{...candidate,id,slug:candidate.id,country_code:candidate.country,status:"verified"}});});
const academic=versions.slice(0,saudiCandidates.length+pakistanCandidates.length);
const industrial={...saudiAnswers,saudiCertificateSubtype:"industrial_certificate",saudiEnrollment:"reported_document",saudiEnrollmentField:"Computing",saudiEnrollmentReference:"Synthetic enrollment document",saudiEnrollmentTargetRelation:"reported_official_previous",saudiEnrollmentTargetRelationReference:"Synthetic applicable enrollment target assessment"} as const;
it.each([{name:"Saudi private",answers:saudiAnswers,path:"studienkolleg",fh:false},{name:"Saudi industrial successful year",answers:industrial,path:"subject_restricted",fh:true},{name:"Pakistan current year",answers:currentPakistanAnswers,path:"subject_restricted",fh:false}])("process reports preserve strict saved $name academic evidence and current selected route",({answers,path,fh})=>{
 const saved=AnswersSchema.parse(answers);const literal=JSON.stringify(saved);const profile=buildProfile(saved);
 const reported=AnswersSchema.parse({...saved,processContext:{version:1,kind:profile.visaApplicationCountry==="pk"?"appointment":"funding",purpose:"study",mission:profile.visaApplicationCountry==="pk"?"islamabad":"riyadh",missionConfirmed:true,fundingMethod:"blocked_account",exception:"none"}});
 const before=evaluateAssessment(profile,academic,context);const after=evaluateAssessment(buildProfile(reported),versions,context);
 expect(before.result.path).toBe(path);expect(before.result.institutionRestriction==="fachhochschule").toBe(fh);expect(after.result).toEqual(before.result);expect(compareAssessments(before,after)).toMatchObject({policyChanged:false,explanationChanged:false,newCoverage:false});
 expect(after.process?.guidance.some(g=>g.status==="current")).toBe(true);
 const {processContext,...unchanged}=withProcessContext(reported,"mission","other");expect(unchanged).toEqual(saved);expect(processContext?.missionConfirmed).toBeUndefined();expect(processContext?.fundingMethod).toBeUndefined();expect(JSON.stringify(saved)).toBe(literal);
 const knowledge=selectedKnowledge(versions,{evaluatedAt:now,profile:buildProfile(reported)});expect(knowledge.chunks.some(c=>c.content.includes("Official source says:")&&c.country_code===(fh?"sa":profile.certificateCountry))).toBe(true);
});
