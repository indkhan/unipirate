"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

import { submitCheck } from "./actions";
import styles from "./check.module.css";
import {
  AWARDING_BODIES,
  BOARD_IDS,
  GCE_GRADES,
  GCE_SUBJECTS,
  INTAKE_OPTIONS,
  TARGET_FIELDS,
  isAnswered,
  visibleSteps,
  withAnswer,
  type Answers,
  type GceSubjectAnswer,
  type PartialAnswers,
  type StepId,
} from "./steps";

type Option = { value: unknown; label: string; key: string };

type CheckFlowProps = {
  countries: { code: string; name: string }[];
  boards: { countryCode: string; label: string }[];
  initialAnswers?: PartialAnswers;
};

const QUESTIONS: Record<StepId, { question: string; subtitle?: string }> = {
  targetDegree: { question: "What do you want to study in Germany?" },
  nationality: { question: "What is your nationality?" },
  certificateCountry: {
    question: "Where did you finish school?",
    subtitle: "Or where you will finish it — the country of your certificate.",
  },
  curriculumType: {
    question: "Which curriculum did you study?",
    subtitle: "This decides which rules apply to you.",
  },
  board: { question: "Which board is your certificate from?" },
  schoolGradePercent: {
    question: "What is your overall Class 12 result?",
    subtitle: "Your overall percentage across subjects.",
  },
  jeeAdvanced: {
    question: "Do you have a valid JEE Advanced result?",
    subtitle: "A qualifying JEE Advanced rank changes your admission path.",
  },
  hasExistingApsCertificate: {
    question: "Do you already have an APS certificate?",
  },
  gceAwardingBody: { question: "Which awarding body issued your A-Levels?" },
  gceSchoolYears: {
    question: "How many school years did you complete?",
    subtitle: "Including the A-Level years.",
  },
  gceSubjects: {
    question: "Which subjects did you take?",
    subtitle: "Add each A-Level (AL) and AS subject with its grade.",
  },
  targetField: { question: "What do you want to study?" },
  intake: { question: "When do you want to start?" },
};

const emptySubject: GceSubjectAnswer = {
  subjectId: "mathematics",
  level: "AL",
  grade: "A",
};

export function CheckFlow({
  countries,
  boards,
  initialAnswers = {},
}: CheckFlowProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [answers, setAnswers] = useState<PartialAnswers>(initialAnswers);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    posthog.capture("check_started");
  }, [posthog]);

  const steps = visibleSteps(answers);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;
  const canContinue = isAnswered(answers, step);

  function optionsFor(stepId: StepId): Option[] {
    switch (stepId) {
      case "targetDegree":
        return [
          { value: "bachelor", label: "A Bachelor's degree", key: "bachelor" },
          { value: "master", label: "A Master's degree", key: "master" },
        ];
      case "nationality":
      case "certificateCountry":
        return countries
          .filter((c) => c.code !== "de")
          .map((c) => ({ value: c.code, label: c.name, key: c.code }));
      case "curriculumType":
        return [
          {
            value: "national",
            label: "National board (CBSE, FSc, Tawjihiyah …)",
            key: "national",
          },
          { value: "ib", label: "IB Diploma", key: "ib" },
          { value: "gce", label: "GCE A-Levels", key: "gce" },
          { value: "other", label: "Something else", key: "other" },
        ];
      case "board":
        return boards
          .filter((b) => b.countryCode === answers.certificateCountry)
          .map((b) => ({
            value: BOARD_IDS[b.label] ?? b.label.toLowerCase(),
            label: b.label,
            key: b.label,
          }));
      case "jeeAdvanced":
      case "hasExistingApsCertificate":
        return [
          { value: true, label: "Yes", key: "yes" },
          { value: false, label: "No", key: "no" },
        ];
      case "gceAwardingBody":
        return AWARDING_BODIES.map((b) => ({
          value: b.id,
          label: b.label,
          key: b.id,
        }));
      case "gceSchoolYears":
        return [
          { value: 12, label: "12 years", key: "12" },
          { value: 13, label: "13 years", key: "13" },
        ];
      case "targetField":
        return TARGET_FIELDS.map((f) => ({
          value: f.id,
          label: f.label,
          key: f.id,
        }));
      case "intake":
        return [
          ...INTAKE_OPTIONS.map((o) => ({
            value: { term: o.term, year: o.year },
            label: o.label,
            key: `${o.term}-${o.year}`,
          })),
          { value: null, label: "Not sure yet", key: "unsure" },
        ];
      default:
        return [];
    }
  }

  function currentKey(stepId: StepId): string | undefined {
    const v = answers[stepId];
    if (v === undefined) return undefined;
    if (stepId === "intake") {
      return v === null
        ? "unsure"
        : `${(v as { term: string; year: number }).term}-${(v as { term: string; year: number }).year}`;
    }
    if (typeof v === "boolean") return v ? "yes" : "no";
    return String(v);
  }

  function select(stepId: StepId, value: unknown) {
    setError(null);
    setAnswers((prev) =>
      withAnswer(prev, stepId, value as Answers[typeof stepId]),
    );
  }

  function back() {
    setError(null);
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else router.push("/");
  }

  async function next() {
    setError(null);
    if (!canContinue) {
      setError("Please answer to continue.");
      return;
    }
    posthog.capture("step_completed", { step: stepIndex + 1, question: step });
    if (!isLast) {
      setStepIndex(stepIndex + 1);
      return;
    }
    setSubmitting(true);
    const outcome = await submitCheck(answers);
    if ("error" in outcome) {
      setSubmitting(false);
      setError(outcome.error);
      return;
    }
    posthog.capture("check_completed", { check_id: outcome.id });
    router.push(`/result/${outcome.id}`);
  }

  const subjects = answers.gceSubjects ?? [];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <button type="button" className={styles.backBtn} onClick={back}>
            ‹ Back
          </button>
          <span className={styles.brand}>UniPirate</span>
          <span className={styles.stepLabel}>
            {stepIndex + 1} of {steps.length}
          </span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.dots} aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s} className={styles.dotWrap}>
              <span
                className={[
                  styles.dot,
                  i < stepIndex ? styles.dotDone : "",
                  i === stepIndex ? styles.dotCurrent : "",
                ].join(" ")}
              />
              {i < steps.length - 1 && (
                <span
                  className={[
                    styles.seg,
                    i < stepIndex ? styles.segDone : "",
                  ].join(" ")}
                />
              )}
            </span>
          ))}
        </div>

        <div>
          <h1 className={styles.question}>{QUESTIONS[step].question}</h1>
          {QUESTIONS[step].subtitle && (
            <p className={styles.subtitle}>{QUESTIONS[step].subtitle}</p>
          )}
        </div>

        {step === "schoolGradePercent" ? (
          <div>
            <label className={styles.inputLabel} htmlFor="grade-percent">
              Overall marks · required
            </label>
            <div>
              <input
                id="grade-percent"
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={answers.schoolGradePercent ?? ""}
                onChange={(e) =>
                  select(
                    "schoolGradePercent",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />{" "}
              <span className={styles.hint}>%</span>
            </div>
          </div>
        ) : step === "gceSubjects" ? (
          <div className={styles.options}>
            {subjects.map((s, i) => (
              <div key={i} className={styles.subjectRow}>
                <div className={styles.subjectSelects}>
                  <select
                    className={styles.select}
                    aria-label="Subject"
                    value={s.subjectId}
                    onChange={(e) => {
                      const next = subjects.slice();
                      next[i] = {
                        ...s,
                        subjectId: e.target.value as GceSubjectAnswer["subjectId"],
                      };
                      select("gceSubjects", next);
                    }}
                  >
                    {GCE_SUBJECTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    aria-label="Level"
                    value={s.level}
                    onChange={(e) => {
                      const next = subjects.slice();
                      next[i] = { ...s, level: e.target.value as "AL" | "AS" };
                      select("gceSubjects", next);
                    }}
                  >
                    <option value="AL">A-Level</option>
                    <option value="AS">AS</option>
                  </select>
                  <select
                    className={styles.select}
                    aria-label="Grade"
                    value={s.grade}
                    onChange={(e) => {
                      const next = subjects.slice();
                      next[i] = {
                        ...s,
                        grade: e.target.value as GceSubjectAnswer["grade"],
                      };
                      select("gceSubjects", next);
                    }}
                  >
                    {GCE_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  aria-label="Remove subject"
                  onClick={() =>
                    select(
                      "gceSubjects",
                      subjects.filter((_, j) => j !== i),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addBtn}
              onClick={() =>
                select("gceSubjects", [...subjects, { ...emptySubject }])
              }
            >
              + Add {subjects.length === 0 ? "a subject" : "another subject"}
            </button>
          </div>
        ) : (
          <div className={styles.options}>
            {optionsFor(step).map((o) => {
              const selected = currentKey(step) === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  className={[
                    styles.optionCard,
                    selected ? styles.optionSelected : "",
                  ].join(" ")}
                  aria-pressed={selected}
                  onClick={() => select(step, o.value)}
                >
                  <span>{o.label}</span>
                  <span
                    className={[
                      styles.optionDot,
                      selected ? styles.optionDotSelected : "",
                    ].join(" ")}
                  />
                </button>
              );
            })}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="button"
          className={styles.cta}
          disabled={!canContinue || submitting}
          onClick={next}
        >
          {submitting
            ? "Checking your path…"
            : isLast
              ? "See my result"
              : "Continue"}
        </button>
      </main>
    </div>
  );
}
