import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import type { AdminRule } from "@/lib/db/admin-queries";
import { RuleEditor,RulesTable } from "../rules-panel";
const id="00000000-0000-4000-8000-000000000001", time="2026-01-01T00:00:00Z";
const raw={id,conditions:{},outcomes:{path:"direct"},status:"draft" as const,source_url:"https://example.invalid/",source_quote:"New literal quote",last_verified_at:time,notes:null,slug:null,country_code:null,created_at:time,updated_at:time};
const legacy={id,rule_id:id,version_number:1,supersedes_version_id:null,raw_snapshot:{...raw,status:"verified",source_quote:"Old literal quote"},status:"verified" as const,effective_from:null,effective_until:null,intake_from:null,intake_until:null,provenance:"legacy_capture" as const,reviewed_by:null,reviewed_at:null,published_at:null,captured_at:time,draft_revision:null};
const rule:AdminRule={...raw,draft:{rule_id:id,raw_snapshot:raw,revision:3,edited_by:null,edited_at:time,effective_from:null,effective_until:null,intake_from:null,intake_until:null},versions:[legacy]};
it("separates saving from explicit publication and exposes all review tokens",()=>{
 const html=renderToStaticMarkup(<RuleEditor rule={rule} countries={[]} />);
 expect(html).toContain('name="expected_revision"');expect(html).toContain('name="expected_raw_snapshot"');expect(html).toContain('name="expected_predecessor_id"');expect(html).toContain('name="confirmed"');expect(html).toMatch(/<option value=""[^>]*selected=""/);expect(html).toContain("Save draft");expect(html).toContain("Publish reviewed snapshot");
 expect(html).toContain("Source verification");expect(html).toContain("Publication time");expect(html).toContain("Legacy capture");expect(html).toContain("unknown historical scope");expect(html).toContain("source_quote");expect(html).toContain("Old literal quote");expect(html).toContain("New literal quote");
});
it("lists workspace revision and distinct historical publication status",()=>{
 const html=renderToStaticMarkup(<RulesTable rules={[rule]} selectedRuleId={id}/>);expect(html).toContain("Draft revision");expect(html).toContain("Legacy capture");
});
