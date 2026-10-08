import {ruleReviewReasons} from "@/lib/rules/review-attention";
import {expect,it} from "vitest";
import {processReviewReasons} from "../process";
const now="2026-10-07T00:00:00Z";
const outcome={kind:"appointment",fact_key:"portal",jurisdiction:"pk",purposes:["study"],amounts:[],alternatives:[],additional:[],source_date_annotation:null,effective:{from:null,through:null,intake_indices:null},review_due:now,steps:[],editorial_advice:[]};
const row={last_verified_at:now,outcomes:{process:outcome}};
it("process review ignores generic age and is current at equality, overdue at +1ms",()=>{expect(processReviewReasons(row,now)).toEqual([]);expect(processReviewReasons(row,"2026-10-07T00:00:00.001Z").length).toBeGreaterThan(0);});
it.each([undefined,"bad","2026-10-08T00:00:00Z"])("malformed or future verification receives attention: %s",last_verified_at=>expect(processReviewReasons({...row,last_verified_at},now).length).toBeGreaterThan(0));
it.each([undefined,"bad","2026-10-06T00:00:00Z"])("malformed or backwards review receives attention: %s",review_due=>expect(processReviewReasons({...row,outcomes:{process:{...outcome,review_due}}},now).length).toBeGreaterThan(0));

it("renamed legacy drafts retain review attention through their immutable identity history",()=>{const row={id:"89985eb6-d3a6-41ce-879d-fc4bf4e206c9",slug:"renamed",outcomes:{steps:[{order:41,text:"stale financing"}]},last_verified_at:"2026-10-07T00:00:00Z",versions:[{rule_id:"89985eb6-d3a6-41ce-879d-fc4bf4e206c9",raw_snapshot:{slug:"blocked-account-open"}}]};expect(ruleReviewReasons(row,"2026-10-08T00:00:00Z").length).toBeGreaterThan(0);});
