// Exercise the same candidates that seed creates. Production evaluation reads
// reviewed rows from the database, never this bootstrap module.
import {ruleData} from '../../../scripts/rules.bootstrap';
// Disposable published copies of source-reviewed GCE/IB candidates; never DB publication.
export const fixtureRules=ruleData.map(r=>(r.id.startsWith('gce-')||r.id.startsWith('ib-reviewed-'))?{...r,status:'verified' as const}:r);
