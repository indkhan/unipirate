import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const COURSE_ID = "22222222-2222-4222-8222-222222222222";
const PROGRAMME_ID = "33333333-3333-4333-8333-333333333333";
const OFFERING_ID = "44444444-4444-4444-8444-444444444444";
const REVIEWER_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_URL = "https://www.th-rosenheim.de/study/business";

const stored = vi.hoisted(() => ({
  course: null as unknown,
  programme: null as unknown,
  offerings: [] as unknown[],
  versions: [] as unknown[],
}));
afterEach(() => {
  stored.course = null;
  stored.programme = null;
  stored.offerings = [];
  stored.versions = [];
});

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));
vi.mock("@/lib/db/queries", () => ({
  getCourseById: async () => stored.course,
  listActiveCourseTaskDefinitions: async () => [],
  listApplications: async () => [],
  listTasks: async () => [],
  getProgrammeByLegacyCourse: async () => stored.programme,
  listCourseOfferings: async () => stored.offerings,
  listReviewedOfferingVersions: async () => stored.versions,
}));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));

import CoursePage from "../page";

function baseCourse() {
  return {
    id: COURSE_ID,
    name: "Business Administration",
    university_name: "Rosenheim Technical University of Applied Sciences",
    location: null,
    degree: null,
    language: null,
    tuition: null,
    description: null,
    deadlines: [],
    requirements: [],
    source_url: SOURCE_URL,
    normalized_url: SOURCE_URL,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-02T00:00:00Z",
    review_status: "approved",
    conflicts_with: null,
    imported_by: null,
    extraction_method: null,
    field_extraction: null,
  };
}

function reviewedFacts() {
  const evidence = (quote: string) => [
    {
      source_url: SOURCE_URL,
      source_quote: quote,
      retrieved_at: "2026-10-01T12:00:00Z",
      last_verified_at: "2026-10-02T12:00:00Z",
      verified_by: REVIEWER_ID,
      source_hash: null,
    },
  ];
  return [
    { key: "degree", kind: "description", status: "verified", verbatim: "Bachelor of Science", applicability: "All applicants", route: null, deadline_kind: null, date: null, time: null, timezone: null, evidence: evidence("Bachelor of Science at Rosenheim") },
    { key: "language", kind: "language", status: "verified", verbatim: "English", applicability: "All applicants", route: null, deadline_kind: null, date: null, time: null, timezone: null, evidence: evidence("Teaching language English at Rosenheim") },
    { key: "location", kind: "description", status: "verified", verbatim: "Rosenheim", applicability: "All applicants", route: null, deadline_kind: null, date: null, time: null, timezone: null, evidence: evidence("Campus Rosenheim hosts the programme") },
    { key: "closing", kind: "deadline", status: "verified", verbatim: "Apply by 15 July.", applicability: "All applicants", route: null, deadline_kind: "application_closing", date: null, time: null, timezone: null, evidence: evidence("Apply by 15 July.") },
    { key: "entrance", kind: "prerequisite", status: "verified", verbatim: "University entrance qualification required.", applicability: "All applicants", route: null, deadline_kind: null, date: null, time: null, timezone: null, evidence: evidence("University entrance qualification required.") },
    { key: "route", kind: "route", status: "unresolved", verbatim: null, applicability: "All applicants", route: "unresolved", deadline_kind: null, date: null, time: null, timezone: null, evidence: [] },
  ];
}

function richSetup() {
  stored.course = {
    ...baseCourse(),
    description: "Unscoped raw description should stay hidden",
  };
  stored.programme = { id: PROGRAMME_ID, legacy_course_id: COURSE_ID };
  stored.offerings = [
    { id: OFFERING_ID, programme_id: PROGRAMME_ID, intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", applicability: {}, created_at: "2026-09-03T00:00:00Z" },
  ];
  stored.versions = [
    { id: "66666666-6666-4666-8666-666666666666", offering_id: OFFERING_ID, version: 1, review_status: "verified", reviewed_at: "2026-10-02T12:00:00Z", reviewed_by: REVIEWER_ID, facts: reviewedFacts(), created_at: "2026-10-02T12:00:00Z" },
  ];
}

const renderPage = async () =>
  renderToStaticMarkup(await CoursePage({ params: Promise.resolve({ id: COURSE_ID }) }));

it("rich reviewed course uses ReviewedOfferings as authority without contradictory legacy empties", async () => {
  richSetup();
  const html = await renderPage();
  expect(html).toContain("Business Administration");
  expect(html).toContain("Rosenheim Technical University of Applied Sciences");
  expect(html).toContain("Bachelor of Science");
  expect(html).toContain("English");
  expect(html).toContain("Rosenheim");
  expect(html).toContain("Apply by 15 July.");
  expect(html).toContain("University entrance qualification required.");
  expect(html).toContain("Reviewed intake requirements");
  expect(html).toContain("Unresolved");
  expect(html).toContain(SOURCE_URL);
  expect(html).not.toContain("Not on the page");
  expect(html).not.toContain("No deadlines were found on the page");
  expect(html).not.toContain("No requirements were found on the page");
  expect(html).not.toContain("Unscoped raw description should stay hidden");
});

it("legacy course without versions preserves facts, dates, requirements and honest unknowns", async () => {
  stored.course = {
    ...baseCourse(),
    location: "Berlin",
    degree: "Bachelor of Arts",
    language: "German",
    tuition: "No tuition",
    description: "Legacy description",
    deadlines: ["Winter semester: Apply by 15 July"],
    requirements: ["School certificate"],
  };
  stored.programme = null;
  const html = await renderPage();
  expect(html).toContain("Berlin");
  expect(html).toContain("Bachelor of Arts");
  expect(html).toContain("Legacy description");
  expect(html).toContain("Apply by 15 July");
  expect(html).toContain("School certificate");
  expect(html).not.toContain("Reviewed intake requirements");

  stored.course = { ...baseCourse(), review_status: "approved" };
  const emptyHtml = await renderPage();
  expect(emptyHtml).toContain("Not on the page");
  expect(emptyHtml).toContain("No deadlines were found on the page");
  expect(emptyHtml).toContain("No requirements were found on the page");
});

it("programme with no reviewed versions retains legacy and does not key on research presence", async () => {
  stored.course = {
    ...baseCourse(),
    location: "Berlin",
    degree: "Bachelor of Arts",
    language: "German",
    tuition: "No tuition",
    deadlines: ["Winter semester: Apply by 15 July"],
    requirements: ["School certificate"],
    field_extraction: { research: { format: "up-course-01/v1", status: "draft" } },
  };
  stored.programme = { id: PROGRAMME_ID, legacy_course_id: COURSE_ID };
  stored.offerings = [
    { id: OFFERING_ID, programme_id: PROGRAMME_ID, intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", applicability: {}, created_at: "2026-09-03T00:00:00Z" },
  ];
  stored.versions = [];
  const html = await renderPage();
  expect(html).toContain("Berlin");
  expect(html).toContain("Apply by 15 July");
  expect(html).not.toContain("Reviewed intake requirements");
});

it("pending course without reviewed versions keeps pending banner and gains no reviewed authority", async () => {
  stored.course = { ...baseCourse(), review_status: "pending", location: "Berlin" };
  stored.programme = null;
  const html = await renderPage();
  expect(html).toContain("In review");
  expect(html).toContain("Berlin");
  expect(html).not.toContain("Reviewed intake requirements");
});
