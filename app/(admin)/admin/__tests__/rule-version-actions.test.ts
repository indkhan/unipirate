import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({guard:vi.fn(),save:vi.fn(),publish:vi.fn(),redirect:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAdmin:mocks.guard}));
vi.mock("@/lib/db/admin-queries",()=>({updateAdminRule:mocks.save,publishAdminRuleVersion:mocks.publish,RuleReviewStaleError:class extends Error{}}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import { updateRuleAction, reverifyRuleAction } from "../actions";
const id="00000000-0000-4000-8000-000000000001",time="2026-01-01T00:00:00Z";
const raw={id,conditions:{},outcomes:{path:"direct"},status:"draft",source_url:"https://example.invalid/",source_quote:" Literal ",last_verified_at:time,notes:null,slug:null,country_code:null,created_at:time,updated_at:time,unknown_stored:["x"]};
function form(extra:Record<string,string|undefined>={}){const f=new FormData();for(const[k,v]of Object.entries({id,expected_revision:"3",expected_raw_snapshot:JSON.stringify(raw),expected_predecessor_id:"",raw_snapshot:JSON.stringify(raw),effective_from:"",effective_until:"",intake_from:"",intake_until:"",approval_status:"verified",confirmed:"on",...extra}))if(v!==undefined)f.set(k,v);return f;}
beforeEach(()=>{vi.clearAllMocks();mocks.guard.mockResolvedValue({db:{}});mocks.save.mockResolvedValue({});mocks.publish.mockResolvedValue({});mocks.redirect.mockImplementation(()=>{throw new Error("redirect");});});
it("saves only workspace with unchanged literal verification date",async()=>{
 await expect(updateRuleAction(form())).rejects.toThrow("redirect");expect(mocks.save).toHaveBeenCalledWith({},expect.objectContaining({revision:3,next_snapshot:raw,raw_snapshot:raw}));expect(mocks.publish).not.toHaveBeenCalled();
});
it("reverification appends a version with explicit tokens, not a timestamp edit",async()=>{
 await expect(reverifyRuleAction(form({reviewed_by:id,published_at:"2099-01-01T00:00:00Z"}))).rejects.toThrow("redirect");
 expect(mocks.publish).toHaveBeenCalledWith({}, {rule_id:id,revision:3,raw_snapshot:raw,predecessor_id:null,approval_status:"verified",confirmed:true});expect(mocks.save).not.toHaveBeenCalled();
});
it.each([{confirmed:""},{approval_status:""},{expected_revision:""},{expected_raw_snapshot:JSON.stringify({...raw,conditions:{invented:true}})}])("invalid review %j never calls mutation",async extra=>{
 await expect(reverifyRuleAction(form(extra))).rejects.toThrow("redirect");expect(mocks.publish).not.toHaveBeenCalled();expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("message="));
});
it("friendly stale feedback retains rule selection",async()=>{
 mocks.publish.mockRejectedValue(new Error("rule predecessor changed; reload and review again"));await expect(reverifyRuleAction(form())).rejects.toThrow("redirect");expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("reload%20and%20review"));
});
it("requires admin before any input or write",async()=>{
 mocks.guard.mockRejectedValue(new Error("admin required"));await expect(updateRuleAction(form())).rejects.toThrow("admin required");await expect(reverifyRuleAction(form())).rejects.toThrow("admin required");expect(mocks.save).not.toHaveBeenCalled();expect(mocks.publish).not.toHaveBeenCalled();
});
