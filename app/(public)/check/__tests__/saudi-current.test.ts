import { expect, it } from "vitest";
import { visibleSteps, withAnswer, buildProfile, AnswersSchema, type PartialAnswers } from "../steps";
import { saudiAnswers } from "./saudi.fixture";
it("new documentary national reports and independent completed degree are reachable",()=>{
 const a:PartialAnswers={...saudiAnswers,saudiCertificateVersion:2,saudiCertificateSubtype:"national",saudiNationalStream:"Science Section"};
 expect(visibleSteps(a)).toContain("saudiNationalCategory");expect(visibleSteps(a)).toContain("hasPriorUniversityStudy");
 const d:PartialAnswers={...a,saudiCertificateSubtype:"unknown",priorStudyCompletion:"completed"};expect(visibleSteps(d)).toContain("saudiBachelorAssessment");
});
it("changed intake and stream prune bound reports while first intake and passport preserve",()=>{
 const a:PartialAnswers={...saudiAnswers,saudiCertificateVersion:2,saudiCertificateSubtype:"national",saudiNationalStream:"Literary Section",saudiTargetFamily:"reported_official_economics",saudiTargetFamilyReference:"Synthetic target assessment"};
 expect(withAnswer(a,"saudiNationalStream","Commercial Section").saudiTargetFamilyReference).toBeUndefined();
 expect(withAnswer(a,"intake",{term:"summer",year:2027}).priorStudyTargetRelationReference).toBeUndefined();
 expect(withAnswer({...a,intake:undefined},"intake",a.intake!).saudiTargetFamilyReference).toBe(a.saudiTargetFamilyReference);
 expect(withAnswer(a,"nationality","pk").priorStudyRecognitionReference).toBe(a.priorStudyRecognitionReference);
});

it("unknown school subtype allows independent completed degree evidence and a real complete answer boundary",()=>{
 const a:PartialAnswers={...saudiAnswers,saudiCertificateSubtype:"unknown",priorStudyCompletion:"completed",yearsOfUniversityStudy:4,priorQualificationContext:"national",saudiBachelorAssessment:"reported_official_norms_full_time",saudiBachelorAssessmentReference:"Synthetic applicable exact Bachelor identity/norms/recognition assessment"};
 const p=buildProfile(AnswersSchema.parse(a));expect(p.qualificationHistory?.saudiBachelorEvidence).toMatchObject({version:2,context:"national",assessment:"reported_official_norms_full_time"});expect(p.saudiCertificate?.subtype).toBe("unknown");
 expect(visibleSteps(a).filter(s=>s==="hasPriorUniversityStudy")).toHaveLength(1);
 for(const [key,value] of [["priorDegreeYears",2],["priorStudyRecognition","unknown"],["priorStudyCompletion","in_progress"],["priorStudyField","Changed"],["targetField","physics"]] as const)expect(withAnswer(a,key,value).saudiBachelorAssessmentReference).toBeUndefined();
 expect(withAnswer(a,"visaApplicationCountry","in").saudiBachelorAssessmentReference).toBe(a.saudiBachelorAssessmentReference);
});
it("private version-one stored answers remain readable without new prerequisite certification",()=>{const old={...saudiAnswers,saudiCertificateVersion:1 as const,saudiPrivateAssessmentCoverage:undefined};const p=buildProfile(AnswersSchema.parse(old));expect(p.saudiCertificate?.version).toBe(1);expect(p.saudiCertificate?.privateAssessmentCoverage).toBeUndefined();});

it("fresh unsupported school curriculum still exposes independent degree history on Saudi landing",()=>{const a:PartialAnswers={qualificationHistoryVersion:1,apsScopeVersion:1,targetDegree:"bachelor",certificateCountry:"sa",curriculumType:"other"};expect(visibleSteps(a)).toContain("hasPriorUniversityStudy");});

it("fresh forward independent degree flow retains assessments collected before target/intake",()=>{
 const supplied={...saudiAnswers,curriculumType:"other",priorStudyCompletion:"completed",yearsOfUniversityStudy:4,priorQualificationContext:"national",saudiBachelorAssessment:"reported_official_norms_full_time",saudiBachelorAssessmentReference:"Synthetic applicable exact completed Bachelor identity/norms assessment"} as const;
 let a:PartialAnswers={qualificationHistoryVersion:1,apsScopeVersion:1};
 for(let i=0;i<visibleSteps(a).length;i++){const step=visibleSteps(a)[i];a=withAnswer(a,step,supplied[step as keyof typeof supplied] as never);}
 expect(AnswersSchema.safeParse(a).success).toBe(true);expect(buildProfile(AnswersSchema.parse(a)).qualificationHistory?.saudiBachelorEvidence?.reference).toBe(supplied.saudiBachelorAssessmentReference);
});
