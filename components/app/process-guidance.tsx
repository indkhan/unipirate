import React from "react";
import type {ProcessAssessment} from "@/lib/rules/process-assessment";
export function ProcessGuidanceCard({process}:{process:ProcessAssessment|undefined}) {
 if(!process)return null;
 return <section aria-label="Current visa and funding guidance"><h2>Current visa and funding guidance</h2><p>Assessed at {process.assessedAt}. Confirm your applicable purpose, mission and exceptions. Academic eligibility is separate.</p>
 {process.guidance.map(g=><article key={g.ruleId}><h3>{g.kind.replace(/_/g," ")} · {g.status}</h3>
 {g.status==="current"?<><ul>{g.amounts.map((a,i)=><li key={i}>{a.amount} {a.currency} · {a.period}</li>)}</ul><ul>{g.alternatives.map((a,i)=><li key={i}>{a.text}</li>)}</ul><ul>{g.additional.map((text,i)=><li key={i}>{text}</li>)}</ul><ol>{g.steps.map(s=><li key={s.key}>{s.text}</li>)}</ol>{g.evidence.observation.source_date_annotation&&<p>Source annotation: {g.evidence.observation.source_date_annotation}</p>}<blockquote>{g.evidence.source_quote}</blockquote></>:<p>{g.reasons.join(" ")}</p>}
 {g.status==="current" && g.editorialAdvice.map((advice,i)=><p key={i}>{advice.label}: {advice.text}</p>)}
 <a href={g.evidence.source_url} target="_blank" rel="noreferrer">Official source</a><p>{g.status==="current"?"Source verified: ":"Historical verification metadata: "}{g.evidence.last_verified_at??"unavailable"}</p></article>)}
 {process.unknowns.map((text,i)=><p key={i}>{text}</p>)}<p><a href="/profile">Update optional reported process context</a></p></section>;
}
