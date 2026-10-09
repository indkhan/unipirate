import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ConfirmApprovalDialog,
  ProposalPopup,
  SuggestionsList,
  type TaskProposalView,
} from "../task-suggestions";

function proposal(over: Partial<TaskProposalView> & { id: string }): TaskProposalView {
  return {
    user_id: "00000000-0000-4000-8000-000000000010",
    application_id: null,
    course_id: null,
    semantic_action_key: "prepare:documents",
    stage: "preliminary",
    title: `Suggestion ${over.id.slice(-4)}`,
    description: null,
    reason: "Preparation suggestion; confirm current requirements with the official source before acting.",
    due_date: null,
    verbatim_due: null,
    evidence: [],
    source_version_id: null,
    offering_id: null,
    intake_term: null,
    intake_year: null,
    applicant_group: null,
    input_fingerprint: "in",
    material_fingerprint: `mat-${over.id.slice(-4)}`,
    status: "pending",
    revision: 1,
    approved_revision: null,
    approved_task_id: null,
    base_task_revision: null,
    before_task: null,
    change_fields: [],
    legacy_task_key: null,
    created_at: "2026-10-09T00:00:00Z",
    updated_at: "2026-10-09T00:00:00Z",
    ...over,
  };
}

const approve = () => Promise.resolve();
const reject = () => Promise.resolve();

describe("SuggestionsList static presentation", () => {
  it("shows every pending proposal with no 5-item cap, grouped general + per course", () => {
    const proposals = [
      proposal({ id: "00000000-0000-4000-8000-000000000001" }),
      proposal({ id: "00000000-0000-4000-8000-000000000002" }),
      proposal({ id: "00000000-0000-4000-8000-000000000003" }),
      proposal({ id: "00000000-0000-4000-8000-000000000004" }),
      proposal({ id: "00000000-0000-4000-8000-000000000005" }),
      proposal({ id: "00000000-0000-4000-8000-000000000006" }),
      proposal({
        id: "00000000-0000-4000-8000-000000000007",
        application_id: "aaaaaaaa-0000-4000-8000-000000000001",
        course_id: "bbbbbbbb-0000-4000-8000-000000000001",
        title: "Course deadline check",
      }),
    ];
    const html = renderToStaticMarkup(
      createElement(SuggestionsList, {
        proposals,
        applicationNames: { "aaaaaaaa-0000-4000-8000-000000000001": "TU Munich" },
        approve,
        reject,
      }),
    );
    for (const p of proposals) expect(html).toContain(p.title);
    expect(html).toContain("General");
    expect(html).toContain("TU Munich");
  });

  it("exposes bulk controls and per-row selection checkboxes", () => {
    const proposals = [
      proposal({ id: "00000000-0000-4000-8000-000000000001" }),
      proposal({ id: "00000000-0000-4000-8000-000000000002" }),
    ];
    const html = renderToStaticMarkup(
      createElement(SuggestionsList, { proposals, applicationNames: {}, approve, reject }),
    );
    expect(html).toContain("Approve selected");
    expect(html).toContain("Approve all shown");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
  });

  it("labels preliminary vs reviewed source and never stamps personal values as verified", () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionsList, {
        proposals: [
          proposal({ id: "00000000-0000-4000-8000-000000000001" }),
          proposal({
            id: "00000000-0000-4000-8000-000000000002",
            stage: "verified",
            due_date: "2027-07-15",
            verbatim_due: "15 July 2027",
            source_version_id: "11111111-0000-4000-8000-000000000001",
            evidence: [
              {
                source_url: "https://www.tum.de/study",
                source_quote: "Application deadline 15 July 2027.",
                last_verified_at: "2026-10-08T00:00:00Z",
              },
            ],
          }),
        ],
        applicationNames: {},
        approve,
        reject,
      }),
    );
    expect(html).toContain("Preliminary");
    expect(html).toContain("Reviewed source");
    expect(html).toContain("https://www.tum.de/study");
    expect(html).toContain("Application deadline 15 July 2027.");
    // Personal values are never authoritative: no Verified stamp anywhere.
    expect(html).not.toContain("Verified");
  });

  it("marks parsed dates as personal reminders and shows literal source wording verbatim", () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionsList, {
        proposals: [
          proposal({
            id: "00000000-0000-4000-8000-000000000001",
            stage: "verified",
            due_date: "2027-07-15",
            verbatim_due: "15 July 2027",
            source_version_id: "11111111-0000-4000-8000-000000000001",
            evidence: [
              {
                source_url: "https://www.tum.de/study",
                source_quote: "Application deadline 15 July 2027.",
                last_verified_at: "2026-10-08T00:00:00Z",
              },
            ],
          }),
        ],
        applicationNames: {},
        approve,
        reject,
      }),
    );
    expect(html).toContain("Personal reminder");
    expect(html).toContain("15 July 2027");
  });

  it("renders Update before/after with completion preserved read-only", () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionsList, {
        proposals: [
          proposal({
            id: "00000000-0000-4000-8000-000000000001",
            approved_task_id: "22222222-0000-4000-8000-000000000001",
            before_task: {
              id: "22222222-0000-4000-8000-000000000001",
              title: "Old title",
              description: "Old description",
              due_date: "2027-01-05",
              done: true,
              planning_revision: 2,
            },
            title: "New title",
            change_fields: ["title"],
          }),
        ],
        applicationNames: {},
        approve,
        reject,
      }),
    );
    expect(html).toContain("Update");
    expect(html).toContain("Old title");
    expect(html).toContain("New title");
    expect(html).toContain("Completed");
    // Completion is read-only: the update box itself contains no checkbox input.
    const updateBox = html.slice(html.indexOf("Update to your task"), html.indexOf("Approve", html.indexOf("Update to your task")));
    expect(updateBox).not.toContain('type="checkbox"');
  });

  it("keeps approved/dismissed/recheck history in an accessible collapsed section", () => {
    const html = renderToStaticMarkup(
      createElement(SuggestionsList, {
        proposals: [
          proposal({ id: "00000000-0000-4000-8000-000000000001" }),
          proposal({
            id: "00000000-0000-4000-8000-000000000002",
            status: "approved",
            title: "Already approved",
          }),
          proposal({
            id: "00000000-0000-4000-8000-000000000003",
            status: "dismissed",
            title: "Already dismissed",
          }),
        ],
        applicationNames: {},
        approve,
        reject,
      }),
    );
    expect(html).toContain("History");
    expect(html).toContain("Already approved");
    expect(html).toContain("Already dismissed");
    expect(html).toContain("<details");
  });
});

describe("ConfirmApprovalDialog", () => {
  it("enumerates the exact selected ids, revisions, titles and dates", () => {
    const selection = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        revision: 3,
        title: "First pick",
        dueDate: "2027-07-15",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        revision: 1,
        title: "Second pick",
        dueDate: null,
      },
    ];
    const html = renderToStaticMarkup(
      createElement(ConfirmApprovalDialog, {
        selection,
        pending: false,
        error: null,
        onConfirm: () => {},
        onClose: () => {},
      }),
    );
    for (const s of selection) {
      expect(html).not.toContain(s.id);
      expect(html).toContain(s.title);
    }
    expect(html).toContain("2027-07-15");
    expect(html).toContain("Confirm");
  });
});

describe("ProposalPopup", () => {
  it("renders one course group at a time as a non-modal fixed dialog with actions", () => {
    const html = renderToStaticMarkup(
      createElement(ProposalPopup, {
        proposals: [
          proposal({ id: "00000000-0000-4000-8000-000000000001" }),
          proposal({
            id: "00000000-0000-4000-8000-000000000007",
            application_id: "aaaaaaaa-0000-4000-8000-000000000001",
            course_id: "bbbbbbbb-0000-4000-8000-000000000001",
          }),
        ],
        applicationNames: { "aaaaaaaa-0000-4000-8000-000000000001": "TU Munich" },
        approve,
        reject,
        onClose: () => {},
      }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
    expect(html).toContain("Close");
  });
});
