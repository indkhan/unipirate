"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState, type ReactNode } from "react";

import { submitCheck } from "./actions";
import styles from "./check.module.css";
import { QUESTIONS, buildOptions, type Option } from "./check-questions";
import { GceSubjectsEditor } from "./gce-subjects-editor";
import {
  isAnswered,
  visibleSteps,
  withAnswer,
  type Answers,
  type PartialAnswers,
  type StepId,
} from "./steps";

type CheckFlowProps = {
  countries: { code: string; name: string }[];
  boards: { countryCode: string; label: string }[];
  initialAnswers?: PartialAnswers;
  initialStepIndex?: number;
  userMenu?: ReactNode;
};

export function CheckFlow({
  countries,
  boards,
  initialAnswers = {},
  initialStepIndex = 0,
  userMenu,
}: CheckFlowProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [answers, setAnswers] = useState<PartialAnswers>(initialAnswers);
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
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
    return buildOptions(stepId, { countries, boards, answers });
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
          {userMenu ? <div className={styles.userMenu}>{userMenu}</div> : null}
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
            <div className={styles.percentInputWrap}>
              <input
                id="grade-percent"
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                placeholder="85"
                value={answers.schoolGradePercent ?? ""}
                onChange={(e) =>
                  select(
                    "schoolGradePercent",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
              <span className={styles.percentSuffix}>%</span>
            </div>
            {answers.schoolGradePercent !== undefined &&
              (answers.schoolGradePercent < 0 ||
                answers.schoolGradePercent > 100) && (
                <div className={styles.error}>
                  Enter your overall percentage between 0 and 100.
                </div>
              )}
          </div>
        ) : step === "gceSubjects" ? (
          <GceSubjectsEditor
            subjects={subjects}
            onChange={(next) => select("gceSubjects", next)}
          />
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
