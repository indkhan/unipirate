import type { Tables } from "@/lib/db/database.types";

import type { ResearchAuditRecord } from "@/lib/courses/research";
import { ResearchHistory } from "./research-history";

import { formatDateTime } from "./admin-shared";

export function AuditLog({ events, researchEvents = [] }: { events: Tables<"admin_audit_events">[]; researchEvents?: ResearchAuditRecord[] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Recent audit events</h2>
      <ResearchHistory records={researchEvents} />
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Table</th>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Status change</th>
              <th className="px-3 py-2 font-medium">Actor</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const research = researchEvents.find(r => r.id === event.id);
              const actor = event.course_reconciliation != null ? (research?.status === "available" ? research.payload.reviewed_by : "Research reviewer unavailable") : event.actor_user_id ?? "system";
              return (
              <tr key={event.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-xs">
                  {formatDateTime(event.created_at)}
                </td>
                <td className="px-3 py-2">{event.table_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{event.row_id}</td>
                <td className="px-3 py-2">{event.action}</td>
                <td className="px-3 py-2">
                  {event.old_status ?? "none"} -&gt;{" "}
                  {event.new_status ?? "none"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {actor}
                </td>
              </tr>
            ); })}
          </tbody>
        </table>
        {events.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No audit events yet.
          </p>
        )}
      </div>
    </section>
  );
}
