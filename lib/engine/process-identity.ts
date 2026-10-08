// Known legacy static process identities; source/title edits cannot restore authority.
export const LEGACY_PROCESS_SLUGS=["uni-assist-vpd-process","blocked-account-open","visa-appointment-in","visa-appointment-sa","pk-visa-consular-portal"] as const;
const ids=new Set<string>([...LEGACY_PROCESS_SLUGS,"f6be077a-3e4b-415f-b7b3-62230c8beacb"]);
export function isLegacyProcessIdentity(row:{id?:unknown;slug?:unknown;notes?:unknown}) {
 return typeof row.id==="string" && ids.has(row.id) || typeof row.slug==="string" && ids.has(row.slug) ||
  LEGACY_PROCESS_SLUGS.some(slug=>typeof row.notes==="string" && row.notes.startsWith("Bootstrap candidate: "+slug+"."));
}
export function legacyProcessRuleIds(versions:readonly {rule_id:string;raw_snapshot:unknown}[]) {
 return new Set(versions.filter(v=>v.raw_snapshot && typeof v.raw_snapshot==="object" && isLegacyProcessIdentity(v.raw_snapshot)).map(v=>v.rule_id));
}

/** Historical identity is a quarantine signal, never current matching authority. */
export function processHistoryRuleIds(versions:readonly {rule_id:string;raw_snapshot:unknown}[]) {
 const ids=legacyProcessRuleIds(versions);
 for(const v of versions){const raw=v.raw_snapshot;if(raw && typeof raw==="object" && "outcomes" in raw){const o=raw.outcomes;if(o && typeof o==="object" && Object.hasOwn(o,"process"))ids.add(v.rule_id);}}
 return ids;
}
export function isProcessTaskKey(key:string|null|undefined,ids:ReadonlySet<string>):boolean {
 const match=key?.match(/^rule:([^:]+):step:\d+$/);return !!match&&(ids.has(match[1])||isLegacyProcessIdentity({id:match[1]}));
}
