import { describe, expect, it } from "vitest";
import { buildResearchContext, buildResearchDraft, prepareResearchReview, ResearchDraftSchema } from "../research";
const url="https://www.daad.de/review7", reviewer="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", now="2026-10-07T01:00:00Z";
const seed={url,name:"Synthetic Computing",university:"Synthetic University",text:"Synthetic seed ".repeat(30)};
const scope="Winter 2027 Non-EU applicants";
const fact=(key:string,kind:"language"|"fee",verbatim:string)=>({key,kind,verbatim,applicability:"Non-EU applicants",route:null,deadline_kind:null,evidence:[{source_url:url,source_quote:verbatim}]});
const output=(facts:ReturnType<typeof fact>[])=>({offerings:[{intake_term:"winter",intake_year:2027,applicant_group:"Non-EU applicants",scope:{source_url:url,source_quote:scope},facts}]});
const observation=(content:string)=>({url,origin:"web" as const,retrieved_at:"2026-10-07T00:00:00Z",content:seed.name+" "+seed.university+" "+scope+"\n\n"+content});
export const omittedDraft=()=>buildResearchDraft(seed,[observation(["IELTS 6.5.","Availability notice: Full official context requiring reconciliation. ".padEnd(4000,"x"),"IELTS 7.0."].join("\n\n"))],output([fact("english","language","IELTS 6.5.")]),[]);
describe("review7 omission and overlapping fee boundaries",()=>{
 it("requires explicit reconciliation before an assertion whose captured context was omitted can be verified",()=>{
  const draft=omittedDraft(); const context=buildResearchContext(seed,draft.observations);
  expect(context.sources.some(s=>s.excerpts.some(e=>e.includes("IELTS 7.0.")))).toBe(false);
  expect(()=>prepareResearchReview(draft,0,["english"],reviewer,now)).toThrow(/reconcil/i);
  expect(prepareResearchReview(draft,0,[],reviewer,now).every(f=>f.status==="unresolved")).toBe(true);
 });
 it("does not require reconciliation for fully included paragraphs separated by whitespace",()=>{
  const draft=buildResearchDraft(seed,[observation("IELTS 6.5.\n\nAn application document is required.")],output([fact("english","language","IELTS 6.5.")]),[]);
  expect(prepareResearchReview(draft,0,["english"],reviewer,now).find(f=>f.key==="english")?.status).toBe("verified");
 });
 it("permits an explicit field decision but rejects fabricated draft reconciliation metadata",()=>{
  const draft=omittedDraft();
  expect(prepareResearchReview(draft,0,["english"],reviewer,now,[{key:"english",reason:"Compared full official captures and confirmed this assertion's actual applicability."}]).find(f=>f.key==="english")?.status).toBe("verified");
  expect(ResearchDraftSchema.safeParse({...draft,reconciled:true,reviewed_by:reviewer}).success).toBe(false);
  expect(()=>prepareResearchReview(draft,0,["english"],reviewer,now,[{key:"english",reason:"yes"}])).toThrow();
 });
 it.each([["Tuition EUR 0; semester fee EUR 100.","Semester fee EUR 200.",true],["Tuition EUR 0.","Semester fee EUR 100.",false],["Tuition EUR 0; semester fee EUR 100.","Tuition EUR 0; semester fee EUR 100.",false]])("checks overlapping fee identities %s / %s",(a,b,conflict)=>{
  const draft=buildResearchDraft(seed,[observation(a+"\n\n"+b)],output([fact("mixed","fee",a),fact("semester","fee",b)]),[]);
  expect(draft.conflicts).toHaveLength(conflict?1:0);
  if(conflict) expect(()=>prepareResearchReview(draft,0,["mixed"],reviewer,now)).toThrow();
  const stored=buildResearchDraft(seed,[observation(a+"\n\n"+b)],output([fact("mixed","fee",a)]),[]);
  stored.offerings[0].facts.push({...stored.offerings[0].facts[0],key:"semester",verbatim:b,evidence:[{...stored.offerings[0].facts[0].evidence[0],source_quote:b}]});
  expect(ResearchDraftSchema.safeParse(stored).success).toBe(!conflict);
 });
});
