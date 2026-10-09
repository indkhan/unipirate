import {NextResponse} from "next/server";
import {createClient} from "@/lib/db/server";
import {listTaskProposals,listApplicationsWithCourses,listPlanningJobs} from "@/lib/db/queries";
export async function GET(){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return NextResponse.json({error:"Sign in to see your suggestions."},{status:401});
  const [proposals,applications,jobs]=await Promise.all([listTaskProposals(db,user.id),listApplicationsWithCourses(db,user.id),listPlanningJobs(db,user.id)]);
  return NextResponse.json({proposals,applicationNames:Object.fromEntries(applications.map(a=>[a.id,a.courses?.name??"Course"])),jobs},{headers:{"Cache-Control":"private, no-store"}});
}
