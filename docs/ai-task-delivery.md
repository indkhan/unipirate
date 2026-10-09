# AI task planning delivery (#60)

This feature is delivered as one PR with three internal reviewed milestones,
following the owner's execution instruction and the consolidated requirements
in the current bodies of #60 and #61.

1. Authenticated explicit chat creation, durable operation idempotency and real
   database receipts, integrated with the #59 manual-task contract.
2. Durable event-driven preliminary planning and research integration with
   #57/#58, persistent proposals, approval controls and free-only admin models.
3. Committed reviewed-publication proposals, approved updates to existing tasks
   and all future automatic task generation routed through approval.

Automatic planning stays disabled by default until the complete approval-first
rollout passes. Personal dates are reminders; personal text never grants rule
authority. Student tasks/proposals stay owner-only. Existing tasks, completion,
edits and immutable source history are preserved.

Shared ownership of #57/#58 import processing and #59 course task surfaces must
be confirmed with their orchestrator before those files are changed here.
The #60 branch owns chat authorization/receipts, task proposal persistence and
approval, planner configuration, and the approval-first generation boundary.

This is a delivery checklist, not completion evidence. Final evidence must name
the tested revision, disposable Supabase/RLS runs, repository gates, independent
reviews and genuine recorded browser journeys. No rule publication, deployment
or main merge is authorized merely to produce the demo.
