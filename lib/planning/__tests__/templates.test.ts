import {describe,expect,it} from "vitest";
import {proposalsFromSharedTemplates} from "../templates";
import type {CourseTaskDefinition} from "@/lib/tasks/course-tasks";
const definition=(id:string,kind:CourseTaskDefinition["kind"],sourceKey:string|null):CourseTaskDefinition=>({id,courseId:"course",kind,sourceKey,titleTemplate:"Pay 8400 INR before exemption",description:"Synthetic source-derived instructions",sourceUrl:"https://example.invalid/official",dueMode:"fixed_date",dueDate:"2027-07-15",sortOrder:0,sourceSnapshot:null,retiredAt:null});
describe("verified catalogue shared preparation",()=>{
 it("keeps manual and source-derived non-submission identities without asserting fees, exemptions or official dates",()=>{
  const application={id:"app",status:"planning",course:{id:"course",name:"Synthetic course",university_name:"Synthetic university",source_url:"https://example.invalid/official",created_at:"2026-10-07T00:00:00Z",review_status:"approved",task_definitions:[definition("manual","custom",null),definition("source-derived","requirement","requirements:0"),definition("submission","submission",null)]}};
  const candidates=proposalsFromSharedTemplates(application,"2026-10-10");
  expect(candidates.map(candidate=>candidate.semantic_action_key)).toEqual(["app:app:course-task:manual","app:app:course-task:source-derived"]);
  for(const candidate of candidates){expect(candidate).toMatchObject({stage:"preliminary",due_date:null,verbatim_due:null,evidence:[],source_version_id:null});expect(candidate.title).not.toMatch(/8400|exemption|Pay/);}
 });
});
