import { describe, expect, it } from "vitest";
import { resolveOfferingProcess, generateOfferingProcessTasks, isVisibleOfferingTask, ApplicationOfferingSelectionSchema } from "../offering-process";
import { newGeneratedTaskRows } from "../generate";
import { input, uuid, offering, version, fact, stages, group, selection } from "./offering-process.fixtures";

describe("explicit reviewed offering process", () => {
 it.each([['direct',['university_submission']],['uni_assist',['uni_assist_submission']],['vpd_then_university',['vpd_request','university_submission']],['unresolved',[]]] as const)("%s has only its stages and never mandates payment",(route,expected)=>{
  const plan=resolveOfferingProcess(input(route)); expect(plan.route).toBe(route); expect(plan.stages.map(s=>s.kind)).toEqual(expected);
  const tasks=generateOfferingProcessTasks(uuid(5),'planning',plan); expect(tasks.filter(t=>!t.key.endsWith('fee_confirmation')).map(t=>t.key.split(':').at(-1))).toEqual(expected);
  expect(tasks.some(t=>/^pay|account/i.test(t.title))).toBe(false);
 });
 it("VPD preparation is distinct from closing and preserves nullable timezone",()=>{
  const plan=resolveOfferingProcess(input()); expect(plan.stages[0]).toMatchObject({kind:'vpd_request',portal:stages[0],deadline:stages[4],deadlineLabel:'Preparation target'});
  expect(plan.stages[1]).toMatchObject({kind:'university_submission',portal:stages[1],deadline:stages[3],deadlineLabel:'Application closing'});
  expect(plan.stages[0].deadline?.timezone).toBeNull();
 });
 it("retains exact identity/scope/evidence and stable keys without import-date provenance",()=>{
  const plan=resolveOfferingProcess(input()); const tasks=generateOfferingProcessTasks(uuid(5),'planning',plan);
  expect(plan).toMatchObject({offering,version:version('vpd_then_university',stages),routeFact:version().facts[0]});
  expect(tasks[0]).toMatchObject({key:'app:'+uuid(5)+':offering:'+offering.id+':process:vpd_request',source:{url:version().facts[0].evidence[0].source_url,verifiedAt:version().facts[0].evidence[0].last_verified_at}});
  expect(tasks[0].adminSnapshot).toMatchObject({offering,version:version('vpd_then_university',stages)});
 });
 it.each([null,{offering_id:uuid(88),applicant_context:selection.applicant_context},{...selection,applicant_context:null},{...selection,applicant_context:{applicant_group:'Other',confirmed:true}},{...selection,applicant_context:{applicant_group:group,confirmed:false}}])("missing/opposite/group context remains confirmation %j",s=>{
  const plan=resolveOfferingProcess({...input(),selection:s}); expect(plan.route).toBe('unresolved'); expect(plan.reason).toBeTruthy(); expect(generateOfferingProcessTasks(uuid(5),'planning',plan)).toEqual([]);
 });
 it.each([{country:'XX'},{unknown:false},{constructor:'x'},JSON.parse('{"__proto__":"x"}')])("unsupported vocabulary cannot become universally applicable %j",applicability=>{
  expect(resolveOfferingProcess({...input(),offerings:[{...offering,applicability}]}).route).toBe('unresolved');
 });
 it("wrong course cannot borrow another programme or route",()=>{expect(resolveOfferingProcess({...input(),courseId:uuid(22)}).route).toBe('unresolved');});
 it("independent intakes/groups select by UUID, not profile or country",()=>{
  const other={...offering,id:uuid(33),intake_term:'summer' as const,applicant_group:'Other'};
  const newer={...version('direct'),id:uuid(44),offering_id:other.id};
  const plan=resolveOfferingProcess({...input(),offerings:[other,offering],versions:[newer,...input().versions]}); expect(plan.route).toBe('vpd_then_university');expect(plan.offering?.intake_term).toBe('winter');
 });
 it.each(['missing','unresolved','conflicting','same-value-duplicate','unsupported-scope'])('latest reviewed %s cannot fall back',kind=>{
  const latest={...version('direct'),id:uuid(6),version:2};
  if(kind==='missing')latest.facts=[];
  if(kind==='unresolved')latest.facts=version('unresolved').facts;
  if(kind==='conflicting'||kind==='same-value-duplicate')latest.facts.push(fact('second-route','route','Synthetic second route',{route:kind==='conflicting'?'uni_assist':'direct'}));
  if(kind==='unsupported-scope')latest.facts[0].applicability='Everyone maybe';
  expect(resolveOfferingProcess({...input(),versions:[...input().versions,latest]}).route).toBe('unresolved');
 });
 it.each(['pending','rejected'] as const)('%s research supplies no facts',review_status=>{
  const privateVersion={...version('direct'),id:uuid(6),version:2,review_status,reviewed_at:review_status==='pending'?null:version().reviewed_at,reviewed_by:review_status==='pending'?null:uuid(9)};
  expect(resolveOfferingProcess({...input(),versions:[privateVersion]}).route).toBe('unresolved');
  expect(resolveOfferingProcess({...input(),versions:[...input().versions,privateVersion]}).route).toBe('vpd_then_university');
 });
 it("missing/incorrect portal stage never substitutes an evidence URL",()=>{
  const plan=resolveOfferingProcess({...input('direct'),versions:[version('direct',[fact('old-portal','description','https://example.invalid/old'),fact('process.university.portal','description','Not a portal')])]});
  expect(plan.stages[0].portal).toBeNull(); expect(plan.stages[0].deadline).toBeNull(); expect(plan.stages[0].confirmation).toContain('portal');
 });
 it("literal fees preserve quotes with payer/exceptions confirmation, no calculation",()=>{
  const fee=fact('fees','fee','Synthetic first course EUR 75; additional course EUR 30; university may pay.');
  const plan=resolveOfferingProcess({...input('uni_assist'),versions:[version('uni_assist',[fee])]}); const tasks=generateOfferingProcessTasks(uuid(5),'planning',plan);
  expect(plan.fees).toEqual([fee]);expect(tasks.find(t=>t.key.endsWith('fee_confirmation'))?.adminSnapshot).toMatchObject({fees:[fee]});expect(tasks.map(t=>t.title).join(' ')).toContain('Confirm');expect(tasks.map(t=>t.title).join(' ')).not.toMatch(/Pay|EUR/);
 });
 it.each(['applied','admitted','rejected'])('no new pending process work for %s',status=>{expect(generateOfferingProcessTasks(uuid(5),status,resolveOfferingProcess(input()))).toEqual([]);});
 it('retained edited/completed/inactive identities prevent regeneration',()=>{
  const desired=generateOfferingProcessTasks(uuid(5),'planning',resolveOfferingProcess(input()));
  const rows=desired.map(t=>({task_key:t.key,title:'Personal',done:true,generated_active:false,has_personal_edits:true,due_date:null,verbatim_due:null,sort_order:1,source_url:null,source_verified_at:null,application_id:uuid(5),course_task_definition_id:null,admin_snapshot:t.adminSnapshot})); const before=JSON.stringify(rows);
  expect(newGeneratedTaskRows(uuid(7),desired,rows)).toEqual([]);expect(JSON.stringify(rows)).toBe(before);
 });
 it('context/route/status changes hide pending stages while history/manual remain',()=>{
  const plan=resolveOfferingProcess(input());const task=generateOfferingProcessTasks(uuid(5),'planning',plan)[0];
  const row={task_key:task.key,application_id:uuid(5),done:false};const apps=[{id:uuid(5),status:'planning',plan}];
  expect(isVisibleOfferingTask(row,apps)).toBe(true);
  expect(isVisibleOfferingTask(row,[{...apps[0],plan:resolveOfferingProcess(input('direct'))}])).toBe(false);
  expect(isVisibleOfferingTask(row,[{...apps[0],status:'applied'}])).toBe(false);
  expect(isVisibleOfferingTask(row,[])).toBe(false);
  expect(isVisibleOfferingTask({...row,done:true},[])).toBe(true);
  expect(isVisibleOfferingTask({...row,task_key:null},[])).toBe(true);
 });
 it.each([{...selection,extra:true},{...selection,applicant_context:{...selection.applicant_context,payer:true}},{offering_id:null,applicant_context:selection.applicant_context}])('strict selection rejects extra/inconsistent fields %j',value=>{expect(ApplicationOfferingSelectionSchema.safeParse(value).success).toBe(false);});
});

it('a reviewed undated closing statement still requests date confirmation',()=>{
 const undated=fact('process.university.closing','deadline','Synthetic closing date to confirm',{deadline_kind:'application_closing'});
 expect(resolveOfferingProcess({...input('direct'),versions:[version('direct',[undated])]}).stages[0].confirmation).toContain('closing deadline');
});
it('a preparation fact under a closing-stage key cannot authorize closing',()=>{
 const wrong=fact('process.university.closing','deadline','Synthetic preparation 1 June',{deadline_kind:'vpd_preparation_target',date:'2027-06-01'});
 expect(resolveOfferingProcess({...input('direct'),versions:[version('direct',[wrong])]}).stages[0].deadline).toBeNull();
});

describe('research publication compatibility without changing immutable facts', () => {
 it('source_scope is provenance while additional conditions remain unresolved', () => {
  expect(resolveOfferingProcess({...input('direct'),offerings:[{...offering,applicability:{source_scope:'Winter 2027 Synthetic applicant group'}}]}).route).toBe('direct');
  for (const applicability of [{source_scope:true},{source_scope:['quote']},{source_scope:'quote',country:'XX'}]) {
   expect(resolveOfferingProcess({...input('direct'),offerings:[{...offering,applicability}]}).route).toBe('unresolved');
  }
 });
 it.each([
  ['15 July 2027','2027-07-15'], ['2027-07-15','2027-07-15'], ['15.07.2027','2027-07-15'],
  ['15 July',null], ['31 February 2027',null], ['15 July 2027 or 15 July 2028',null],
  ['from 1 May to 15 July 2027',null], ['15 July – 1 August 2027',null],
  ['July 1, July 15, 2027',null],
 ] as const)('only an unambiguous explicit source date sorts: %s', (wording,date) => {
  const deadline=fact('deadline:university:application_closing','deadline','University application closes '+wording,{deadline_kind:'application_closing'});
  const before=JSON.stringify(deadline);
  const plan=resolveOfferingProcess({...input('direct'),versions:[version('direct',[deadline])]});
  expect(plan.stages[0].deadline).toEqual(deadline); expect(plan.stages[0].dueDate).toBe(date);
  expect(generateOfferingProcessTasks(uuid(5),'planning',plan)[0]).toMatchObject({dueDate:date,verbatimDue:deadline.verbatim});
  expect(JSON.stringify(deadline)).toBe(before); expect(plan.stages[0].deadline?.date).toBeNull();
 });
 it.each(['verified','unresolved'] as const)('coexisting legacy and producer identities require confirmation (%s)', status => {
  const legacy=fact('process.university.closing','deadline','Synthetic closing 15 July 2027',{deadline_kind:'application_closing',date:'2027-07-15'});
  const producer=fact('deadline:university:application_closing','deadline','University application closes 1 August 2027',{deadline_kind:'application_closing',status,verbatim:status==='unresolved'?null:'University application closes 1 August 2027'});
  const plan=resolveOfferingProcess({...input('direct'),versions:[version('direct',[legacy,producer])]});
  expect(plan.stages[0].deadline).toBeNull(); expect(plan.stages[0].dueDate).toBeNull();
 });
 it('wrong stage/kind/applicant and unreviewed facts cannot provide dates or portals', () => {
  const wrong=fact('deadline:university:application_closing','deadline','University application closes 15 July 2027',{deadline_kind:'application_closing',applicability:'Other'});
  const plan=resolveOfferingProcess({...input('direct'),versions:[version('direct',[wrong,fact('application_link:uniassist','description','https://example.invalid/assist')])]});
  expect(plan.stages[0]).toMatchObject({portal:null,deadline:null,dueDate:null});
 });
});
