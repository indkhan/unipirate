"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Json } from "@/lib/db/database.types";
import { conditionRowsToJson, jsonToConditionRows, type ConditionRow } from "./rule-draft";

export function GuidedRuleFields({ conditions, outcomes }: { conditions: Json; outcomes: Json }) {
  const initial = useMemo(() => JSON.stringify(conditions, null, 2), [conditions]);
  const [rows, setRows] = useState(() => jsonToConditionRows(conditions));
  const [advanced, setAdvanced] = useState(initial);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const sync = (next: ConditionRow[]) => { setRows(next); setAdvanced(JSON.stringify(conditionRowsToJson(next), null, 2)); setDirty(true); };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return <div className="grid gap-3">
    <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Conditions</legend><p className="mb-3 text-xs text-muted-foreground">Each fact must match for this rule to apply.</p>
      <div className="grid gap-2">{rows.map((row, index) => <div key={`${row.fact}-${index}`} className="grid gap-2 rounded-md bg-muted/40 p-2 md:grid-cols-[1fr_120px_1fr_auto]">
        <label className="grid gap-1 text-xs font-medium">Fact<input value={row.fact} onChange={e => sync(rows.map((r,i) => i === index ? {...r, fact:e.target.value} : r))} className="h-9 rounded border bg-background px-2 font-mono" /></label>
        <label className="grid gap-1 text-xs font-medium">Operator<select value={row.operator} onChange={e => sync(rows.map((r,i) => i === index ? {...r, operator:e.target.value, valueType: e.target.value === "in" || e.target.value === "nin" ? "array" : r.valueType} : r))} className="h-9 rounded border bg-background px-2"><option>eq</option><option>neq</option><option>gte</option><option>lte</option><option>gt</option><option>lt</option><option>in</option><option>nin</option></select></label>
        <label className="grid gap-1 text-xs font-medium">Value<input value={row.value} onChange={e => sync(rows.map((r,i) => i === index ? {...r, value:e.target.value} : r))} className="h-9 rounded border bg-background px-2" /></label>
        <Button type="button" variant="destructive" className="self-end" onClick={() => sync(rows.filter((_,i) => i !== index))}>Remove</Button>
      </div>)}</div><Button type="button" variant="outline" className="mt-3" onClick={() => sync([...rows, {fact:"",operator:"eq",value:"",valueType:"string"}])}>Add condition</Button>
    </fieldset>
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Advanced JSON</summary><div className="mt-3 grid gap-3 lg:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Conditions JSON<textarea name="conditions" value={advanced} rows={12} onChange={e => { setAdvanced(e.target.value); setDirty(true); }} onBlur={() => { try { const next=jsonToConditionRows(advanced); setRows(next); setAdvanced(JSON.stringify(conditionRowsToJson(next),null,2)); setError(""); } catch(e) { setError(e instanceof Error ? e.message : "Invalid JSON"); } }} className="rounded-md border bg-background p-2 font-mono text-xs" />{error && <span role="alert" className="text-xs text-destructive">{error}</span>}</label><label className="grid gap-1 text-xs font-medium">Outcomes JSON<textarea name="outcomes" defaultValue={JSON.stringify(outcomes,null,2)} rows={12} onChange={() => setDirty(true)} className="rounded-md border bg-background p-2 font-mono text-xs" /></label></div></details>
    {!rows.length && <p className="text-sm text-[var(--signal)]">This rule has no conditions and may apply broadly. Verify that this is intentional.</p>}
  </div>;
}
