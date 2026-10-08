import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({requireUser:vi.fn(),set:vi.fn(),materialize:vi.fn(),revalidate:vi.fn(),done:vi.fn(),status:vi.fn()}));
vi.mock('@/lib/auth/session',()=>({requireUser:mocks.requireUser}));vi.mock('@/lib/db/queries',()=>({setApplicationOfferingSelection:mocks.set,setTaskDone:mocks.done,updateApplicationStatus:mocks.status}));vi.mock('@/lib/tasks/materialize',()=>({materializeCourseTasksForApplication:mocks.materialize}));vi.mock('next/cache',()=>({revalidatePath:mocks.revalidate}));
import {selectApplicationOffering,toggleTask,setApplicationStatus} from '../actions';
import {uuid,selection} from '@/lib/tasks/__tests__/offering-process.fixtures';
beforeEach(()=>{vi.resetAllMocks();mocks.requireUser.mockResolvedValue({db:{},user:{id:uuid(7)}});});
it('authenticated offering selection materializes event-time work and refreshes dashboard',async()=>{await selectApplicationOffering({id:uuid(5),selection});expect(mocks.set).toHaveBeenCalledWith({},uuid(7),{id:uuid(5),selection});expect(mocks.materialize).toHaveBeenCalledWith({},uuid(7),uuid(5));expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard');});
it('invalid reported authority fails before auth/write',async()=>{await expect(selectApplicationOffering({id:uuid(5),selection:{...selection,applicant_context:{...selection.applicant_context,payer:true}}})).rejects.toThrow();expect(mocks.requireUser).not.toHaveBeenCalled();expect(mocks.set).not.toHaveBeenCalled();});
it('VPD completion writes only task done, never application status',async()=>{await toggleTask({id:uuid(50),done:true});expect(mocks.done).toHaveBeenCalledWith({},uuid(7),uuid(50),true);expect(mocks.status).not.toHaveBeenCalled();expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard');});

it('returning to planning materializes the explicitly selected offering even if selected while applied',async()=>{await setApplicationStatus({id:uuid(5),status:'planning'});expect(mocks.materialize).toHaveBeenCalledWith({},uuid(7),uuid(5));});
