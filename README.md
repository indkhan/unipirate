# UniPirate

A typed Next.js frontend for the UniPirate qualification-recognition and German
bachelor's course-finder prototype.

## Run locally

Node.js 20.9 or newer is required.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The App Router exposes `/`, `/profile`, `/recognition`, and `/courses`.

## Validate

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Add reviewed data

The application intentionally ships without admissions facts. Add countries,
qualifications, recognition rules, universities, and courses to
`lib/data.ts`. TypeScript checks the complete `UniPirateData` contract.

Until that dataset is populated, the demo action is disabled, onboarding is a
read-only shell with empty options, and the finder presents an honest empty
state.
