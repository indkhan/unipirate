import { describe, expect, it } from "vitest";
import { buildResearchDraft, prepareResearchReview, ResearchDraftSchema } from "../research";
const url="https://www.daad.de/review8", reviewer="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", now="2026-10-07T01:00:00Z";
const seed={url,name:"Synthetic Computing",university:"Synthetic University",text:"Synthetic seed ".repeat(30)};
const scope="Winter 2027 Non-EU applicants";
const candidate=(key:string,kind:"language"|"fee"|"document",verbatim:string,group="Non-EU applicants",source=url)=>({key,kind,verbatim,applicability:group,route:null,deadline_kind:null,evidence:[{source_url:source,source_quote:verbatim}]});
function fixture(kind:"language"|"fee",first:string,second:string,aliasKind:"language"|"fee"|"document"=kind,alias=first) {
 const facts=[candidate("original",kind,first),candidate("other",kind,second)];
 const offering={intake_term:"winter",intake_year:2027,applicant_group:"Non-EU applicants",scope:{source_url:url,source_quote:scope},facts};
 const observation={url,origin:"web" as const,retrieved_at:"2026-10-07T00:00:00Z",content:seed.name+" "+seed.university+" "+scope+"\n\n"+[first,second,alias].join("\n\n")};
 const draft=buildResearchDraft(seed,[observation],{offerings:[offering]},[]);
 const supported=buildResearchDraft(seed,[observation],{offerings:[{...offering,facts:[candidate("arbitrary-new-key",aliasKind,alias)]}]},[]);
 draft.offerings[0].facts.push(supported.offerings[0].facts.find(f=>f.key==="arbitrary-new-key")!);
 return draft;
}
describe("stored unresolved conflicts cannot be bypassed by aliases",()=>{
 it.each([
  ["language","IELTS 6.5.","IELTS 7.0."],
  ["language","IELTS 6.5 or TOEFL 90.","IELTS 7.0."],
  ["language","Unknown test score 60.","Unknown test score 70."],
  ["fee","Tuition EUR 0; semester fee EUR 100.","Semester fee EUR 200."],
 ] as const)("rejects pending %s alias while retaining a known conflict",(kind,first,second)=>{
  const draft=fixture(kind,first,second);
  expect(draft.conflicts).toHaveLength(1);
  expect(ResearchDraftSchema.safeParse(draft).success).toBe(false);
  expect(()=>prepareResearchReview(draft,0,["arbitrary-new-key"],reviewer,now,[{key:"arbitrary-new-key",reason:"Explicit omission reconciliation does not settle the known disagreement."}])).toThrow();
 });
 it.each([
  ["language","IELTS 6.5.","IELTS 7.0.","language","TOEFL 90."],
  ["fee","Tuition EUR 100.","Tuition EUR 200.","fee","Semester fee EUR 50."],
  ["language","IELTS 6.5.","IELTS 7.0.","document","Certified transcript."],
 ] as const)("retains an independently supported disjoint %s assertion",(kind,first,second,aliasKind,alias)=>{
  const draft=fixture(kind,first,second,aliasKind,alias);
  expect(ResearchDraftSchema.safeParse(draft).success).toBe(true);
  expect(prepareResearchReview(draft,0,["arbitrary-new-key"],reviewer,now).find(f=>f.key==="arbitrary-new-key")?.status).toBe("verified");
  expect(draft.offerings[0].facts.find(f=>f.key==="original")?.status).toBe("unresolved");
 });
 it.each(["offering", "applicant", "retained", "quote"])("rejects a corrupted known conflict %s boundary",change=>{
  const draft=fixture("language","IELTS 6.5.","IELTS 7.0.");draft.offerings[0].facts.pop();
  if(change==="offering") draft.conflicts[0].offering=8;
  if(change==="applicant") draft.conflicts[0].alternatives[0].applicability="EU applicants";
  if(change==="retained") draft.offerings[0].facts=draft.offerings[0].facts.filter(f=>f.key!=="original");
  if(change==="quote") draft.conflicts[0].alternatives[0].evidence[0].source_quote="Fabricated quote";
  expect(ResearchDraftSchema.safeParse(draft).success).toBe(false);
 });
 it("keeps genuinely separate captured applicant scopes independent",()=>{
  const draft=fixture("language","IELTS 6.5.","IELTS 7.0.");draft.offerings[0].facts.pop();
  const otherUrl="https://www.daad.de/review8-eu",otherScope="Winter 2027 EU applicants";
  const observation={url:otherUrl,origin:"web" as const,retrieved_at:"2026-10-07T00:00:00Z",content:seed.name+" "+seed.university+" "+otherScope+" IELTS 6.5."};
  const other=buildResearchDraft(seed,[observation],{offerings:[{intake_term:"winter",intake_year:2027,applicant_group:"EU applicants",scope:{source_url:otherUrl,source_quote:otherScope},facts:[candidate("arbitrary-new-key","language","IELTS 6.5.","EU applicants",otherUrl)]}]},[]);
  draft.observations.push(observation);draft.offerings.push(other.offerings[0]);
  expect(ResearchDraftSchema.safeParse(draft).success).toBe(true);
  expect(prepareResearchReview(draft,1,["arbitrary-new-key"],reviewer,now).find(f=>f.key==="arbitrary-new-key")?.status).toBe("verified");
 });
});
