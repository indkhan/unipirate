import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
const proof = /- name: Prove RLS suite actually executed\s+run: \|\s+node -e '([\s\S]*?)'\s*\n\s*- name:/.exec(workflow)![1];
const passed = (name: string, statuses = ["passed"]) => ({ name, assertionResults: statuses.map(status => ({ title: "synthetic case", status })) });
const featureSuites=["personal-tasks.integration.test.ts","planning.integration.test.ts","planning-cursor.integration.test.ts","planning-research.integration.test.ts","planning-events.integration.test.ts","planning-retry.integration.test.ts","reconciliation.integration.test.ts"];
const allPassed=()=>[passed("rls.integration.test.ts"),passed("course-process.integration.test.ts"),...featureSuites.map(name=>passed(name))];
function runProof(testResults: unknown[]) {
  const directory = mkdtempSync(path.join(tmpdir(), "course-process-ci-"));
  try {
    writeFileSync(path.join(directory, "vitest.json"), JSON.stringify({ testResults }));
    return spawnSync(process.execPath, ["-e", proof], { env: { ...process.env, RUNNER_TEMP: directory }, encoding: "utf8" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
describe("actual CI report proof rejects skipped integration", () => {
  it("requires the course-process suite in addition to RLS", () => {
    expect(runProof([passed("rls.integration.test.ts")]).status).not.toBe(0);
  });
  it.each([{statuses:[]}, {statuses:["pending"]}, {statuses:["skipped"]}, {statuses:["failed"]}])("rejects absent passed course cases: %j", ({statuses}) => {
    expect(runProof([passed("rls.integration.test.ts"), passed("course-process.integration.test.ts", statuses)]).status).not.toBe(0);
  });
  it("preserves RLS enforcement", () => {
    expect(runProof([passed("course-process.integration.test.ts")]).status).not.toBe(0);
  });
  it("accepts every required suite only when every case passes", () => {
    expect(runProof(allPassed()).status).toBe(0);
  });
  it.each(featureSuites)("rejects a skipped feature suite: %s",name=>{
    const report=allPassed().map(suite=>suite.name===name?passed(name,["pending"]):suite);
    expect(runProof(report).status).not.toBe(0);
  });
});
