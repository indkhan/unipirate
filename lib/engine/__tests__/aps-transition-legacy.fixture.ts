// Authorized public inventory snapshot; no live reads or metadata rewrites.
export const legacyTransitionRules = [
  {
    "id": "8d95fa83-385f-4863-88cc-7dfe0a3036c6",
    "slug": "in-school-studienkolleg-ws2026",
    "conditions": {
      "board": {
        "op": "in",
        "value": [
          "cbse",
          "cisce",
          "state_board"
        ]
      },
      "curriculum": "national",
      "intake_index": {
        "op": "gte",
        "value": 4053
      },
      "jee_advanced": false,
      "target_degree": "bachelor",
      "class12_percent": {
        "op": "gte",
        "value": 70
      }
    },
    "outcomes": {
      "note": "From Winter Semester 2026/27, Class XII with at least 70% may qualify for the subject-restricted Studienkolleg pathway.",
      "path": "studienkolleg"
    },
    "status": "verified",
    "source_url": "https://aps-india.de/news/",
    "source_quote": "From Winter Semester 2026/27, Class XII plus APS may qualify for subject-restricted admission via Studienkolleg when the certificate shows at least 70%.",
    "last_verified_at": "2026-07-04T00:00:00+00:00"
  },
  {
    "id": "c29d930a-87c9-49ba-8e30-b764e42760ca",
    "slug": "in-70pct-insufficient-ws2026",
    "conditions": {
      "board": {
        "op": "in",
        "value": [
          "cbse",
          "cisce",
          "state_board"
        ]
      },
      "curriculum": "national",
      "intake_index": {
        "op": "gte",
        "value": 4053
      },
      "jee_advanced": false,
      "target_degree": "bachelor",
      "class12_percent": {
        "op": "lt",
        "value": 70
      },
      "has_existing_aps": false
    },
    "outcomes": {
      "note": "From Winter Semester 2026/27, a new applicant without an existing APS certificate needs at least 70% overall in Class XII for the Studienkolleg or one-year-bachelor pathways.",
      "path": "insufficient"
    },
    "status": "verified",
    "source_url": "https://aps-india.de/news/",
    "source_quote": "anabin criteria updated 15 March 2026; for admissions from Winter Semester 2026/27, minimum 70% overall in Class XII, all boards, applies to BOTH pathways",
    "last_verified_at": "2026-07-04T00:00:00+00:00"
  },
  {
    "id": "1cb0cf24-8f39-44b4-b692-b9cb164e47fd",
    "slug": "in-70pct-grandfathered-aps-unknown",
    "conditions": {
      "board": {
        "op": "in",
        "value": [
          "cbse",
          "cisce",
          "state_board"
        ]
      },
      "curriculum": "national",
      "intake_index": {
        "op": "gte",
        "value": 4053
      },
      "jee_advanced": false,
      "target_degree": "bachelor",
      "class12_percent": {
        "op": "lt",
        "value": 70
      },
      "aps_application_day": {
        "op": "lt",
        "value": 20260315
      }
    },
    "outcomes": {
      "note": "Your APS application predates 15 March 2026 and is assessed under the old criteria. The APS certificate remains valid, but the university makes the final admission decision; confirm the pathway with the university.",
      "path": "unknown"
    },
    "status": "verified",
    "source_url": "https://aps-india.de/news/",
    "source_quote": "Applications submitted before 15 March 2026 are assessed based on the criteria applicable at the time of submission; already-issued APS certificates remain valid.",
    "last_verified_at": "2026-07-04T00:00:00+00:00"
  }
] as const;
