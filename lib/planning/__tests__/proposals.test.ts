import { describe, expect, it } from "vitest";
import { ProposalCandidateSchema, reconcileProposal, proposalsFromGeneratedTasks, proposalsFromOfferingPlan, proposalsFromOfferingRequirements, proposalsForWithdrawnApprovedActions } from "../proposals";
import { resolveOfferingProcess } from "@/lib/tasks/offering-process";
import { input, uuid, fact, version } from "@/lib/tasks/__tests__/offering-process.fixtures";
const candidate = { semantic_action_key: "verify:procedure", stage: "preliminary", title: "Confirm the application procedure", description: null, reason: "No applicable reviewed procedure", due_date: null, verbatim_due: null, evidence: [], source_version_id: null, legacy_task_key: null };
describe("approval-first planning", () => {
  it("withdrawn approved facts create a safe same-key date-clearing Update only for the exact offering",()=>{
    const key=`app:${uuid(5)}:offering:${uuid(3)}:process:university_submission`;
    const saved={application_id:uuid(5),offering_id:uuid(3),semantic_action_key:key,approved_task_id:uuid(20),title:"Review university instructions",description:"Existing review guidance",legacy_task_key:key,status:"approved" as const};
    const updates=proposalsForWithdrawnApprovedActions([saved,{...saved,offering_id:uuid(30),semantic_action_key:`app:${uuid(5)}:offering:${uuid(30)}:process:university_submission`}],[],uuid(5),uuid(3));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({semantic_action_key:key,title:saved.title,description:saved.description,stage:"preliminary",source_version_id:null,due_date:null,verbatim_due:null,evidence:[]});
    expect(updates[0].reason).toMatch(/no longer supports/);
    expect(proposalsForWithdrawnApprovedActions([saved],[key],uuid(5),uuid(3))).toEqual([]);
    expect(proposalsForWithdrawnApprovedActions([saved],[],uuid(5),null)).toEqual([]);
  });
  it("proposes every scoped reviewed document/language/prerequisite as literal review work without adjudicating exemptions",()=>{
    const facts=[fact("documents:transcript","document","Supply the official transcript."),fact("language:conditional","language","IELTS is waived only for the published named qualifications."),fact("academic:credits","prerequisite","The published prerequisite is 30 ECTS in mathematics.")];
    const plan=resolveOfferingProcess({...input("direct"),versions:[version("direct",facts)]});
    const proposals=proposalsFromOfferingRequirements(uuid(5),"planning",plan);
    expect(proposals).toHaveLength(3);
    expect(proposals.map(p=>p.description)).toEqual(facts.map(f=>f.verbatim));
    expect(proposals.every(p=>p.stage==="verified" && p.due_date===null && /Review/.test(p.title))).toBe(true);
    expect(proposals[1].title).not.toMatch(/waived|exempt|eligible/i);
  });
  it("keeps VPD and university submission distinct with immutable scope and literal evidence",()=>{
    const proposals=proposalsFromOfferingPlan(uuid(5),"planning",resolveOfferingProcess(input()),"2026-10-10");
    expect(proposals.map(p=>p.semantic_action_key.split(":").at(-1))).toEqual(["vpd_request","university_submission","fee_confirmation"]);
    expect(proposals[0]).toMatchObject({stage:"verified",source_version_id:uuid(4),due_date:"2027-06-01",verbatim_due:"Synthetic preparation target 1 June 2027"});
    expect(proposals.every(p=>ProposalCandidateSchema.safeParse(p).success)).toBe(true);
    expect(proposals[0].evidence.some(e=>e.source_quote.includes("preparation target"))).toBe(true);
  });
  it("retains old literal deadline wording without presenting it as a current due date",()=>{
    expect(proposalsFromOfferingPlan(uuid(5),"planning",resolveOfferingProcess(input()),"2028-01-01")[0].due_date).toBeNull();
  });
  it("rejects preliminary authoritative dates and forged verification", () => {
    expect(ProposalCandidateSchema.safeParse(candidate).success).toBe(true);
    expect(ProposalCandidateSchema.safeParse({...candidate,due_date:"2027-07-15"}).success).toBe(false);
    expect(ProposalCandidateSchema.safeParse({...candidate,stage:"verified"}).success).toBe(false);
  });
  it("rejects a normalized deadline that does not match a single explicit literal source date",()=>{
    const verified={...candidate,stage:"verified",source_version_id:uuid(4),evidence:[{source_url:"https://example.invalid/source",source_quote:"University application closes 15 July 2027.",last_verified_at:"2026-10-08T00:00:00Z"}],verbatim_due:"University application closes 15 July 2027.",due_date:"2027-07-15"};
    expect(ProposalCandidateSchema.safeParse(verified).success).toBe(true);
    expect(ProposalCandidateSchema.safeParse({...verified,due_date:"2099-07-15"}).success).toBe(false);
    expect(ProposalCandidateSchema.safeParse({...verified,verbatim_due:"Between 1 and 15 July 2027."}).success).toBe(false);
  });
  it("rewording does not reopen a dismissed action; material evidence does", () => {
    expect(reconcileProposal({status:"dismissed",material_fingerprint:"same",approved_task_id:null},"same",null)).toBe("keep");
    expect(reconcileProposal({status:"dismissed",material_fingerprint:"old",approved_task_id:null},"new",null)).toBe("pending");
  });
  it("never replaces a deleted approved task and proposes updates to the same completed row", () => {
    expect(reconcileProposal({status:"approved",material_fingerprint:"old",approved_task_id:"task"},"new",null)).toBe("keep");
    expect(reconcileProposal({status:"approved",material_fingerprint:"old",approved_task_id:"task"},"new",{id:"task",done:true})).toBe("update");
  });
  it("keeps distinct semantic task scopes and never imports legacy dates as preliminary evidence", () => {
    const tasks = [{key:"app:a:process:vpd_request",title:"Request VPD",dueDate:"2027-06-01",verbatimDue:"1 June 2027",order:20,applicationId:"a",ruleId:null,courseTaskDefinitionId:null,adminSnapshot:null,source:null}];
    const proposals = proposalsFromGeneratedTasks(tasks);
    expect(proposals[0]).toMatchObject({semantic_action_key:tasks[0].key,stage:"preliminary",due_date:null,legacy_task_key:tasks[0].key});
    expect(ProposalCandidateSchema.safeParse(proposals[0]).success).toBe(true);
  });
  it("does not repeat definitive fees, exemptions or deadlines from legacy generated wording",()=>{
    const [proposal]=proposalsFromGeneratedTasks([{key:"rule:synthetic:step:1",title:"Pay 8400 INR by 15 July 2027; you are exempt from APS",dueDate:"2027-07-15",verbatimDue:"15 July 2027",order:1,applicationId:null,ruleId:null,courseTaskDefinitionId:null,adminSnapshot:null,source:{url:"https://example.invalid/official",verifiedAt:"2026-10-01T00:00:00Z"}}]);
    expect(JSON.stringify(proposal)).not.toMatch(/8400|exempt|15 July/);
    expect(proposal.title).toBe("Prepare to verify the applicable qualification requirements");
    expect(proposal.description).toContain("https://example.invalid/official");
    expect(proposal.evidence).toEqual([]);
  });
});
