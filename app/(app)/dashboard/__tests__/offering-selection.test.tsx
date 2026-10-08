import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
import {OfferingSelection} from "../offering-selection";
import {resolveOfferingProcess} from "@/lib/tasks/offering-process";
import {input,offering,selection,version,fact} from "@/lib/tasks/__tests__/offering-process.fixtures";
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('../actions',()=>({selectApplicationOffering:vi.fn()}));
it('shows explicit intake/group report and separate VPD/university evidence with preparation label',()=>{
 const plan=resolveOfferingProcess(input());const html=renderToStaticMarkup(<OfferingSelection applicationId="application" context={{plan,offerings:[offering],selection}}/>);
 expect(html).toContain('winter 2027');expect(html).toContain(offering.applicant_group);expect(html).toContain('I report');expect(html).toContain('Request VPD');expect(html).toContain('Submit university application');expect(html).toContain('Preparation target');expect(html).toContain('Application closing');expect(html).toContain('https://example.invalid/assist');expect(html).toContain('https://example.invalid/university');expect(html).toContain('2026-10-08T00:00:00Z');expect(html).toContain('Synthetic evidence');expect(html).not.toContain('Pay EUR');
});
it('unknown route supplies targeted official confirmation and no application portal substitute',()=>{
 const plan=resolveOfferingProcess({...input(),versions:[version('unresolved')]});const html=renderToStaticMarkup(<OfferingSelection applicationId="application" context={{plan,offerings:[offering],selection}}/>);
 expect(html).toContain('unresolved');expect(html).toContain('Official source');expect(html).not.toContain('Application portal');expect(html).not.toContain('Pay');
});
it('literal quoted fee is guidance requiring payer/exception confirmation',()=>{
 const fee=fact('fees','fee','Synthetic fee EUR 75; university may pay.');const plan=resolveOfferingProcess({...input('uni_assist'),versions:[version('uni_assist',[fee])]});const html=renderToStaticMarkup(<OfferingSelection applicationId="application" context={{plan,offerings:[offering],selection}}/>);expect(html).toContain(fee.verbatim);expect(html).toContain('Confirm the payer');expect(html).toContain('portal');
});
