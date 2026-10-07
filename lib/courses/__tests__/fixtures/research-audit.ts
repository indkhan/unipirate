const actor = "11111111-1111-4111-8111-111111111111";
const canonical = "22222222-2222-4222-8222-222222222222";
export const auditFixture = {
  id: actor, row_id: canonical, table_name: "courses", action: "update", actor_user_id: null, created_at: "2026-10-07T13:00:00+00:00",
  course_reconciliation: {
    format: "up-course-01/reconciliation-v1", submitted_course_id: actor, reviewed_by: actor, reviewed_at: "2026-10-07T13:00:00.000Z",
    identity: { name: "Synthetic Computing", university: "Synthetic University", source_url: "https://www.daad.de/synthetic" },
    scope: { intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", applicability: { source_scope: "Winter 2027 Non-EU applicants" }, scope: { source_url: "https://www.daad.de/synthetic", source_quote: "Winter 2027 Non-EU applicants" } },
    offering_index: 0, accepted_keys: ["english"], decisions: [{ key: "english", reason: "Compared full captured sources and field applicability." }],
    observations: [{ url: "https://www.daad.de/synthetic", origin: "paste", retrieved_at: "2026-10-07T12:00:00.123+00:00", content: "Literal complete original pasted capture" }],
    version: { id: actor, offering_id: canonical, version: 2 },
  },
};
