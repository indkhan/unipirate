import { evaluate } from "../evaluate";
import { fixtureRules } from "./rules.fixture";
import { p9CbseInRiyadh } from "./personas";
import { describe, expect, it } from "vitest";
import { ProcessOutcomeSchema, projectProcess } from "../process";

const now = "2026-10-07T00:00:00.000Z";
const id = "12345678-1234-4123-8123-123456789abc";
const outcome = { kind: "funding", fact_key: "livelihood", jurisdiction: "in", purposes: ["study"], amounts: [{ amount: "11,904.—", currency: "EUR", period: "year" }], alternatives: [{ method: "blocked_account", text: "Blocked bank account" }, { method: "scholarship", text: "German or EU scholarship" }, { method: "commitment", text: "Formal Declaration of Commitment" }], additional: ["Education loan proof is additional"], source_date_annotation: "16.02.2026 - Article", effective: { from: null, through: null, intake_indices: null }, review_due: now, steps: [{ order: 41, text: "Confirm applicable financing with the mission" }], editorial_advice: [] };
const rule = (changes: Record<string, unknown> = {}) => ({ id, matched: true, status: "verified", source_url: "https://india.diplo.de/in-en/service/2756350-2756350", source_quote: "currently amounting to 11,904.—EUR", last_verified_at: now, outcomes: { process: outcome }, ...changes });
const profile = { visaApplicationCountry: "in", processContext: { purpose: "study", missionConfirmed: true, fundingMethod: "blocked_account", exception: "none" } };
const run = (p: unknown = profile, rs: unknown[] = [rule()], time = now) => projectProcess(p, rs, time);

describe("pure process projection", () => {
 it("retains verbatim alternatives and stable logical UUID step keys", () => { const r = run(); expect(r.guidance[0].status).toBe("current"); expect(r.guidance[0].amounts).toEqual(outcome.amounts); expect(r.guidance[0].alternatives).toEqual(outcome.alternatives); expect(r.guidance[0].steps[0].key).toBe('rule:'+id+':step:41'); });
 it("is current through the deadline and overdue at +1ms", () => { expect(run().guidance[0].status).toBe("current"); expect(run(profile,[rule()],"2026-10-07T00:00:00.001Z").guidance[0].status).toBe("review_needed"); expect(run(profile,[rule()],"2026-10-07T00:00:00.001Z").guidance[0].amounts).toEqual([]); });
 it.each([undefined,null,"invalid","2026-10-08T00:00:00Z"])("cannot authorize verification %s", date => { expect(run(profile,[rule({last_verified_at:date})]).guidance.every(g=>g.amounts.length===0)).toBe(true); });
 it("rejects draft and unmatched candidates",()=>{expect(run(profile,[rule({status:"draft"}),rule({matched:false})]).guidance).toEqual([]);});
 it("never infers India filing from nationality or applies it to Saudi/Pakistan",()=>{for(const p of [{nationality:"in"},{nationality:"in",visaApplicationCountry:"sa"},{visaApplicationCountry:"pk"}]){expect(run(p).guidance).toEqual([]);expect(run(p).unknowns.length).toBeGreaterThan(0);}});
 it.each([{}, {purpose:"study"}, {purpose:"study",missionConfirmed:true}, {purpose:"study",missionConfirmed:true,fundingMethod:"blocked_account"}])("missing mission/purpose/method/exception is conditional", context=>{expect(run({visaApplicationCountry:"in",processContext:context}).guidance[0].status).toBe("conditional");});
 it.each(["scholarship","commitment"])("%s never requires a blocked account", method=>{const r=run({...profile,processContext:{...profile.processContext,fundingMethod:method}});expect(r.guidance[0].amounts).toEqual([]);expect(r.guidance[0].status).toBe("conditional");expect(r.guidance[0].alternatives).toEqual(outcome.alternatives);});
 it("loan only is unresolved, saved reminders cannot authorize facts",()=>{expect(run({...profile,processContext:{...profile.processContext,fundingMethod:"loan"}}).guidance[0].status).toBe("unknown");expect(run({savedTasks:[{title:"11,904 EUR",done:true}]}).guidance).toEqual([]);});
 it("conflicts preserve both sources without a winner",()=>{const other=rule({id:"22345678-1234-4123-8123-123456789abc",source_url:"https://saudiarabien.diplo.de/",outcomes:{process:{...outcome,amounts:[{amount:"11.208",currency:"EUR",period:"year"}],source_date_annotation:"2022"}}});const r=run(profile,[rule(),other]);expect(r.guidance.map(g=>g.status)).toEqual(["unresolved","unresolved"]);expect(r.guidance.every(g=>g.amounts.length===0)).toBe(true);expect(r.guidance.map(g=>g.evidence.source_url)).toHaveLength(2);});
 it("assessment time is strict UTC and not intake",()=>{expect(()=>run(profile,[rule()],"2026-10-07T02:00:00+02:00")).toThrow();expect(()=>run(profile,[rule()],"2026-02-30T00:00:00Z")).toThrow();expect(run({...profile,intake:{term:"winter",year:2099}}).guidance[0].status).toBe("current");});
 it("validates the additive raw outcomes shape",()=>{expect(ProcessOutcomeSchema.safeParse(outcome).success).toBe(true);expect(ProcessOutcomeSchema.safeParse({...outcome,review_due:"bad"}).success).toBe(false);});
});

// Boundary and exception regression cases use disposable observations only.
describe("process boundaries and exceptions",()=>{
 const withOutcome=(patch:Record<string,unknown>)=>rule({outcomes:{process:{...outcome,...patch}}});
 it("due before verification cannot authorize an amount",()=>{expect(run(profile,[withOutcome({review_due:"2026-10-06T23:59:59Z"})]).guidance[0].status).toBe("review_needed");});
 it("effective UTC bounds and explicit intake scope are independent",()=>{const r=withOutcome({review_due:"2027-01-01T00:00:00Z",effective:{from:"2026-10-07T00:00:00Z",through:"2026-10-07T00:00:00Z",intake_indices:[4053]}});expect(run({...profile,intake:{term:"winter",year:2026}},[r]).guidance[0].status).toBe("current");expect(run({...profile,intake:{term:"summer",year:2026}},[r]).guidance).toEqual([]);expect(run(profile,[r]).guidance[0].status).toBe("conditional");expect(run(profile,[r],"2026-10-07T00:00:00.001Z").guidance).toEqual([]);});
 it("age17 selects minor; exact18 INR gap remains unknown",()=>{const minor=withOutcome({kind:"visa_fee",fact_key:"national_fee",age:{min:0,max:17},amounts:[{amount:"4200",currency:"INR",period:"application"}]});const adult=withOutcome({kind:"visa_fee",fact_key:"national_fee",age:{min:19,max:null},amounts:[{amount:"8300",currency:"INR",period:"application"}]});expect(run({...profile,processContext:{...profile.processContext,age:17}},[minor,adult]).guidance[0].amounts[0].amount).toBe("4200");expect(run({...profile,processContext:{...profile.processContext,age:18}},[minor,adult]).guidance).toEqual([]);expect(run(profile,[minor,adult]).guidance.every(g=>g.status==="conditional")).toBe(true);});
 it("FFO EUR bracket includes18 and scholarship waiver stays conditional",()=>{const adult=withOutcome({kind:"visa_fee",age:{min:18,max:null},amounts:[{amount:"75",currency:"EUR",period:"application"}]});expect(run({...profile,processContext:{...profile.processContext,age:18}},[adult]).guidance[0].status).toBe("current");expect(run({...profile,processContext:{...profile.processContext,age:18,exception:"public_scholarship"}},[adult]).guidance[0].amounts).toEqual([]);});
 it("confirmed uni-assist/VPD only; university-paid suppresses payment",()=>{const r=withOutcome({kind:"uni_assist_fee",jurisdiction:null,purposes:["application"],amounts:[{amount:"75.00",currency:"EUR",period:"first course per semester"},{amount:"30.00",currency:"EUR",period:"additional course per semester"}]});for(const route of ["uni_assist","vpd"]){expect(run({processContext:{purpose:"application",applicationRoute:route,universityPays:false}},[r]).guidance[0].status).toBe("current");expect(run({processContext:{purpose:"application",applicationRoute:route,universityPays:true}},[r]).guidance[0].amounts).toEqual([]);}for(const route of [undefined,"unknown","direct"]){expect(run({processContext:{purpose:"application",applicationRoute:route}},[r]).guidance).toEqual([]);}});
 it("Saudi annotation2024 is not an effective date or SAR conversion",()=>{const r=withOutcome({jurisdiction:"sa",source_date_annotation:"2024",amounts:[{amount:"11.904",currency:"EUR",period:"year"}]});const g=run({...profile,visaApplicationCountry:"sa",nationality:"in"},[r]).guidance[0];expect(g.status).toBe("current");expect(g.evidence.observation.effective.from).toBeNull();expect(g.evidence.observation.source_date_annotation).toBe("2024");expect(g.amounts.some(a=>a.currency==="SAR")).toBe(false);});
 it("INR8300 and8400 conflict regardless of newest verification",()=>{const a=withOutcome({kind:"visa_fee",age:{min:19,max:null},amounts:[{amount:"8300",currency:"INR",period:"application"}]});const b={...a,id:"22345678-1234-4123-8123-123456789abc",last_verified_at:"2026-10-06T00:00:00Z",outcomes:{process:{...a.outcomes.process,amounts:[{amount:"8400",currency:"INR",period:"application"}]}}};expect(run({...profile,processContext:{...profile.processContext,age:20}},[a,b]).guidance.every(g=>g.status==="unresolved")).toBe(true);});
 it("wrong purpose never applies study guidance",()=>{expect(run({...profile,processContext:{...profile.processContext,purpose:"standalone_language"}}).guidance).toEqual([]);});
 it("does not mutate profile, academic/APS outcomes, or candidate raw JSON",()=>{const p={...profile,targetDegree:"bachelor",curriculumType:"national"};const rs=[rule({outcomes:{process:outcome,path:"direct",aps_scopes:{qualification:{value:"required"}}}})];const snapshot=JSON.stringify([p,rs]);run(p,rs);run(p,[rule({outcomes:{process:{...outcome,amounts:[{amount:"changed",currency:"EUR",period:"year"}]}}})]);expect(JSON.stringify([p,rs])).toBe(snapshot);});
 it("editorial advice is explicitly labelled",()=>{expect(run(profile,[withOutcome({editorial_advice:["Plan ahead"]})]).guidance[0].editorialAdvice).toEqual([{label:"Editorial planning advice",text:"Plan ahead"}]);});
});

describe("academic isolation", () => {
 it("process fee revisions leave actual admission and scoped APS evaluation identical", () => {
  const before = evaluate(p9CbseInRiyadh, fixtureRules);
  run({...p9CbseInRiyadh, processContext: profile.processContext}, [rule()]);
  run(profile, [rule({outcomes:{process:{...outcome,amounts:[{amount:"992.—",currency:"EUR",period:"month"}]}}})]);
  expect(evaluate(p9CbseInRiyadh, fixtureRules)).toEqual(before);
 });
});

describe("integration scope safety",()=>{
 it("requires exact reported mission for mission-specific observations",()=>{const r=rule({outcomes:{process:{...outcome,mission:"islamabad"}}});expect(run(profile,[r]).guidance[0].status).toBe("conditional");expect(run({...profile,processContext:{...profile.processContext,mission:"islamabad"}},[r]).guidance[0].status).toBe("current");});
 it("preserves microsecond clock around an inclusive review endpoint",()=>{expect(run(profile,[rule()],"2026-10-07T00:00:00.000001Z").guidance[0].status).toBe("review_needed");});
});

it("preserves PostgreSQL UTC offsets and rejects reversed microsecond effective endpoints",()=>{
 const row={...rule(),last_verified_at:"2026-10-07T00:00:00+00:00"};
 expect(projectProcess(profile,[row],now).guidance[0]?.status).toBe("current");
 expect(ProcessOutcomeSchema.safeParse({...row.outcomes.process,effective:{from:"2026-10-07T00:00:00.000002Z",through:"2026-10-07T00:00:00.000001Z",intake_indices:null}}).success).toBe(false);
});

it.each(["other","unknown"])("valid reported filing country %s remains honest unknown",visaApplicationCountry=>{expect(()=>projectProcess({visaApplicationCountry},[],now)).not.toThrow();expect(projectProcess({visaApplicationCountry},[],now).guidance).toEqual([]);});
