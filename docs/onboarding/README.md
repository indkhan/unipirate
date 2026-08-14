# New contributor guide

Welcome to UniPirate. This directory is the shortest path from a fresh clone
to a safe first change.

## Read in this order

1. [Set up the project](setup.md) and run it locally.
2. Read the [product rules and architecture](../application.md). Pay special
   attention to honest unknowns, citations, the pure-core/I/O-shell split,
   and RLS.
3. Check the [MVP status](mvp-status.md) before choosing work.
4. Follow the [change workflow](making-changes.md) while implementing it.

Also read [AGENTS.md](../../AGENTS.md) before changing code. It is the
canonical source for repository conventions. Known product and UX issues are
tracked in [bugs.md](../bugs.md).

## A useful first day

- [ ] Start the app and complete one eligibility check.
- [ ] Read the result's source citations and one explicit unknown outcome.
- [ ] Sign in and inspect the dashboard and course finder.
- [ ] Trace one flow from a page or action into `lib/`, then into a query
      helper in `lib/db/queries.ts`.
- [ ] Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- [ ] Pick one small, self-contained change with its test and documentation.

## When you are unsure

Do not guess about admission facts, deadlines, fees, requirements, or product
priority. Keep an unknown explicit, link to the official source, and ask a
maintainer. A smaller truthful result is better than a polished invented one.

