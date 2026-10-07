"use client";

import { z } from "zod";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/app/theme-toggle";

import { submitCheck } from "./actions";
import styles from "./check.module.css";
import { QUESTIONS, buildOptions, type Option } from "./check-questions";
import { QualificationTextInput } from "./qualification-text-input";
import { GceSubjectsEditor } from "./gce-subjects-editor";
import { IbSubjectsEditor } from "./ib-subjects-editor";
import {
  NUMBER_STEPS,
  PartialAnswersSchema,
  normalizeAnswers,
  isAnswered,
  isNumberStep,
  isIndiaStudyBranch,
  isTextStep,
  visibleSteps,
  withAnswer,
  type Answers,
  type PartialAnswers,
  type StepId,
} from "./steps";

type CheckFlowProps = {
  initialAnswers?: PartialAnswers;
  initialStepIndex?: number;
  userMenu?: ReactNode;
};

const SavedCheckStateSchema = z.object({
  answers: PartialAnswersSchema,
  stepIndex: z.number().int().nonnegative().optional(),
}).strict();
type SavedCheckState = z.infer<typeof SavedCheckStateSchema>;

const CHECK_HISTORY_STEP_KEY = "__unipirateCheckStep";
const CHECK_STORAGE_PREFIX = "unipirate.check.v1";

export function CheckFlow({
  initialAnswers = {},
  initialStepIndex = 0,
  userMenu,
}: CheckFlowProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [answers, setAnswers] = useState<PartialAnswers>(() => normalizeAnswers({ ...PartialAnswersSchema.parse(initialAnswers), ...(initialAnswers.curriculumType === "gce" ? {gceVersion: 1 as const} : {}), qualificationHistoryVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, ...(initialAnswers.curriculumType === 'ib' ? {ibVersion:1 as const} : {}), indiaStudyRouteVersion: 1, jeeVersion: 1 }));
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const [historyDepth, setHistoryDepth] = useState(0);
  const storageKey = `${CHECK_STORAGE_PREFIX}:${
    initialAnswers.certificateCountry ?? "none"
  }`;

  useEffect(() => {
    posthog.capture("check_started");
  }, [posthog]);

  useEffect(() => {
    const safeInitial = normalizeAnswers({ ...PartialAnswersSchema.parse(initialAnswers), ...(initialAnswers.curriculumType === "gce" ? {gceVersion: 1 as const} : {}), qualificationHistoryVersion: 1 as const, apsScopeVersion: 1 as const, apsTransitionVersion: 1 as const, dmatVersion: 1 as const, ...(initialAnswers.curriculumType === 'ib' ? {ibVersion:1 as const} : {}), indiaStudyRouteVersion: 1 as const, jeeVersion: 1 as const });
    let nextAnswers: PartialAnswers = safeInitial;
    let nextStepIndex = initialStepIndex;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = SavedCheckStateSchema.parse(JSON.parse(raw));
        const savedCountry = saved.answers?.certificateCountry;
        if (
          // The storage key already separates landing countries. A new master's
          // answers intentionally contain no school certificate country.
          (saved.answers?.targetDegree === "master" && saved.answers.qualificationHistoryVersion === 1) ||
          !initialAnswers.certificateCountry ||
          savedCountry === initialAnswers.certificateCountry
        ) {
          const recovered = normalizeAnswers({ ...saved.answers, ...(saved.answers?.curriculumType === "gce" ? {gceVersion: 1 as const} : {}), apsScopeVersion: 1 as const, apsTransitionVersion: 1 as const, dmatVersion: 1 as const, ...(saved.answers.curriculumType === 'ib' ? {ibVersion:1 as const} : {}), indiaStudyRouteVersion: 1 as const, jeeVersion: 1 as const });
          const savedSteps = visibleSteps(recovered);
          const firstMissing = savedSteps.findIndex((step) => !isAnswered(recovered, step));
          const recoveredStepIndex = Math.min(
            Math.max(saved.stepIndex ?? initialStepIndex, 0),
            Math.max(savedSteps.length - 1, 0),
            // Newly added questions must not be skipped by a stored numeric index.
            firstMissing === -1 ? savedSteps.length - 1 : firstMissing,
          );
          nextAnswers = recovered;
          nextStepIndex = recoveredStepIndex;
        }
      }
    } catch {
      nextAnswers = safeInitial;
      nextStepIndex = initialStepIndex;
      sessionStorage.removeItem(storageKey);
    } finally {
      window.history.replaceState(
        {
          ...(window.history.state ?? {}),
          [CHECK_HISTORY_STEP_KEY]: nextStepIndex,
        },
        "",
        window.location.href,
      );
      queueMicrotask(() => {
        setAnswers(nextAnswers);
        setStepIndex(nextStepIndex);
        setRestored(true);
      });
    }
  }, [initialAnswers, initialStepIndex, storageKey]);

  const steps = visibleSteps(answers);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;
  const canContinue = isAnswered(answers, step);
  const questionCopy = QUESTIONS[step];
  const numberStep = isNumberStep(step) ? NUMBER_STEPS[step] : null;
  const numberError =
    isNumberStep(step) && answers[step] !== undefined && !canContinue
      ? numberStep!.error
      : null;

  useEffect(() => {
    if (!restored) return;
    const safeStepIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0));
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        answers,
        stepIndex: safeStepIndex,
      } satisfies SavedCheckState),
    );
  }, [answers, restored, stepIndex, steps.length, storageKey]);

  useEffect(() => {
    if (!restored) return;
    function onPopState(event: PopStateEvent) {
      const historyStep = event.state?.[CHECK_HISTORY_STEP_KEY];
      if (typeof historyStep !== "number") return;
      const safeStepIndex = Math.min(
        Math.max(historyStep, 0),
        Math.max(visibleSteps(answers).length - 1, 0),
      );
      setError(null);
      setHistoryDepth((depth) => Math.max(depth - 1, 0));
      setStepIndex(safeStepIndex);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [answers, restored]);

  function optionsFor(stepId: StepId): Option[] {
    return buildOptions(stepId, answers);
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
    if (stepIndex > 0) {
      if (
        historyDepth > 0 &&
        window.history.state?.[CHECK_HISTORY_STEP_KEY] === stepIndex
      ) {
        window.history.back();
      } else {
        const previousStepIndex = stepIndex - 1;
        setStepIndex(previousStepIndex);
        window.history.replaceState(
          {
            ...(window.history.state ?? {}),
            [CHECK_HISTORY_STEP_KEY]: previousStepIndex,
          },
          "",
          window.location.href,
        );
      }
    } else router.push("/");
  }

  async function next() {
    setError(null);
    if (!canContinue) {
      setError("Please answer to continue.");
      return;
    }
    posthog.capture("step_completed", { step: stepIndex + 1, question: step });
    if (!isLast) {
      const nextStepIndex = stepIndex + 1;
      setStepIndex(nextStepIndex);
      setHistoryDepth((depth) => depth + 1);
      window.history.pushState(
        {
          ...(window.history.state ?? {}),
          [CHECK_HISTORY_STEP_KEY]: nextStepIndex,
        },
        "",
        window.location.href,
      );
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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <button type="button" className={styles.backBtn} onClick={back}>
            ‹ Back
          </button>
          <span className={styles.brand}>UniPirate</span>
          <span className={styles.stepLabel}>
            Step {Math.min(stepIndex, steps.length - 1) + 1}
          </span>
          <div className={styles.headerActions}>
            <ThemeToggle />
            {userMenu ? <div className={styles.userMenu}>{userMenu}</div> : null}
          </div>
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
          <h1 className={styles.question}>{questionCopy.question}</h1>
          {questionCopy.subtitle && (
            <p className={styles.subtitle}>{questionCopy.subtitle}</p>
          )}
          {questionCopy.sourceUrl && <a href={questionCopy.sourceUrl} target="_blank" rel="noreferrer">Official source guidance</a>}
        </div>

        {numberStep && isNumberStep(step) ? (
          <div>
            <label className={styles.inputLabel} htmlFor={`${step}-input`}>
              {numberStep.label}
            </label>
            <div className={styles.percentInputWrap}>
              <input
                id={`${step}-input`}
                className={styles.input}
                type="number"
                inputMode="decimal"
                step={step === "priorDegreeYears" || step === "yearsOfUniversityStudy" ? "any" : undefined}
                min={numberStep.min}
                max={numberStep.max}
                aria-invalid={numberError ? "true" : undefined}
                aria-describedby={numberError ? `${step}-error` : undefined}
                placeholder={numberStep.placeholder}
                value={answers[step] ?? ""}
                onChange={(e) =>
                  select(
                    step,
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
              {"suffix" in numberStep && (
                <span className={styles.percentSuffix}>{numberStep.suffix}</span>
              )}
            </div>
            {numberError && (
              <p id={`${step}-error`} className={styles.fieldError}>
                {numberError}
              </p>
            )}
          {answers.ibVersion===1 && ['ibExamYear','ibSchoolYears','ibTotalPoints'].includes(step) && <button type="button" aria-pressed={answers[step]===null} onClick={()=>select(step,null)}>Cannot confirm</button>}
            {step === "yearsOfUniversityStudy" && isIndiaStudyBranch(answers) && <button type="button" aria-pressed={answers[step] === null} onClick={() => select(step, null)}>Cannot establish successful academic years</button>}
          </div>
        ) : isTextStep(step) ? (
          <QualificationTextInput step={step} value={answers[step]} onChange={(value) => select(step, value)} />
        ) : step === "gceSubjects" ? (
          <GceSubjectsEditor
            subjects={answers.gceSubjects ?? []}
            onChange={(next) => select("gceSubjects", next)}
          />
        ) : step === "ibSubjects" ? (
          <IbSubjectsEditor
            subjects={answers.ibSubjects ?? []}
            onChange={(next) => select("ibSubjects", next)}
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
