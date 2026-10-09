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

Shared ownership is agreed with the #47–#59 orchestrator in thread
`bc32c89e-3b9d-4365-89d2-0b5fae6b808e`. That thread owns #57/#58 import UI
and #59 course task surfaces; those features are not implemented independently here.
The #60 branch owns chat authorization/receipts, task proposal persistence and
approval, planner configuration, and the approval-first generation boundary.

Milestone verification on 2026-10-10 used the separate disposable project
`unipirate-ai60-20261010` (API 56321, database 56322). All additive migrations
applied from a clean local reset. Seven SQL regression gates passed before test
fixtures: offerings, reconciliation audit, research metadata CAS, application
selection, assessment history, rule versions and AI planning. SQL files were
transferred as exact UTF-8 bytes; a PowerShell text pipe corrupts source-hash fixtures.

The full suite passed 2,926 tests with zero skips. Its seven required database
suites ran 43 actual cases: RLS 29, course process 3, personal tasks 4,
planning/publication 4, cursor 1, research persistence 1 and template reconciliation 1.
Lint, nonincremental typecheck and production build passed. Independent milestone
reviews found and corrected stale edit forms, source-link reconciliation and
out-of-order polling. Mounted UI tests cover same-tick mutation guards, exact bulk
snapshots, bounded 103-item approval, partial failures and deferred polling races.

Actual private Vault/pg_cron/pg_net dispatch reached the protected local worker
route with HTTP 200 and a retry count. The event remained durable, recorded the
real provider failure and wrote no tasks. Cron is paused and the local flag is
off during ordinary tests and idle periods; dispatch must be tested separately
because background leases can consume test fixtures. Successful provider-backed
planning and the final recorded workflow remain outstanding. The live free
catalogue is reachable, but the assistant evaluation hit the shared provider's
daily quota and failed (1/20); catalogue availability is not inference success.

T3 Preview now supports real browser interactions and MP4 recording. Explicit
chat creation succeeded before quota exhaustion, and actual browser checks showed
student A's manual task absent from student B's dashboard for the same shared
course. Student access to admin settings redirected to the dashboard; the admin
free-model catalogue/save flow worked. Existing recording clips are partial,
not the required complete feature demo. Compatible #59 UI, final provider-backed
journeys/evaluation, exact-head review/CI and the complete video remain release gates.
The PR stays draft until these pass. Final PR evidence must identify its tested
revision and genuine limitations. No live academic-rule publication, deployment
or main merge is authorized merely to produce the demo.
