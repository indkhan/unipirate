"use client";
import {ProcessContextEditor} from "./process-context-editor";

import { z } from "zod";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/app/theme-toggle";

import { submitCheck } from "./actions";
import styles from "./check.module.css";
import { questionFor, buildOptions, type Option } from "./check-questions";
import { QualificationTextInput } from "./qualification-text-input";
import { GceSubjectsEditor } from "./gce-subjects-editor";
import { IbSubjectsEditor } from "./ib-subjects-editor";
import { nextEntryStep, restoredStepIndex } from "./entry";
import {
  NUMBER_STEPS,
  PartialAnswersSchema,
  normalizeAnswers,
  upgradeSaudiAnswers,
  isSaudiStudyBranch,
  pakistanAnswerVersion,
  isAnswered,
  isNumberStep,
  isIndiaStudyBranch,
  isPakistanBranch,
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
  entryDegree?: "bachelor" | "master";
};

const SavedCheckStateSchema = z.object({
  answers: PartialAnswersSchema,
  stepIndex: z.number().int().nonnegative().optional(),
  stepId: z.string().min(1).max(100).optional(),
}).strict();
type SavedCheckState = z.infer<typeof SavedCheckStateSchema>;

const CHECK_HISTORY_STEP_KEY = "__unipirateCheckStep";
const CHECK_STORAGE_PREFIX = "unipirate.check.v1";

export function CheckFlow({
  initialAnswers = {},
  initialStepIndex,
  userMenu,
  entryDegree,
}: CheckFlowProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [answers, setAnswers] = useState<PartialAnswers>(() => normalizeAnswers(upgradeSaudiAnswers({ ...PartialAnswersSchema.parse(initialAnswers), ...(initialAnswers.curriculumType === "gce" ? {gceVersion: 1 as const} : {}), qualificationHistoryVersion: 1, qualificationGuidanceVersion: 1, apsScopeVersion: 1, apsTransitionVersion: 1, dmatVersion: 1, ...(initialAnswers.curriculumType === 'ib' ? {ibVersion:1 as const} : {}), indiaStudyRouteVersion: 1, ...pakistanAnswerVersion(initialAnswers), jeeVersion: 2 })));
  const startStepIndex = initialStepIndex ?? nextEntryStep(initialAnswers);
  const [stepIndex, setStepIndex] = useState(startStepIndex);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const storageKey = `${CHECK_STORAGE_PREFIX}:${
    initialAnswers.certificateCountry ?? "none"
  }${entryDegree ? `:${entryDegree}` : ""}`;
  const activeStorageKey = useRef(storageKey);
  const activeEntryUrl = useRef<string | null>(null);
  const restoredEntry = useRef<string | null>(null);

  useEffect(() => {
    posthog.capture("check_started");
  }, [posthog]);

  useEffect(() => {
    const entry = JSON.stringify([initialAnswers, startStepIndex, storageKey, entryDegree]);
    // History traversal can deliver a new server props object for the same entry.
    // Restore once per entry, preserving the question selected by Back/Forward.
    if (restoredEntry.current === entry) return;
    restoredEntry.current = entry;
    activeStorageKey.current = storageKey;
    activeEntryUrl.current = window.location.href;
    const safeInitial = normalizeAnswers(upgradeSaudiAnswers({ ...PartialAnswersSchema.parse(initialAnswers), ...(initialAnswers.curriculumType === "gce" ? {gceVersion: 1 as const} : {}), qualificationHistoryVersion: 1 as const, qualificationGuidanceVersion: 1, apsScopeVersion: 1 as const, apsTransitionVersion: 1 as const, dmatVersion: 1 as const, ...(initialAnswers.curriculumType === 'ib' ? {ibVersion:1 as const} : {}), indiaStudyRouteVersion: 1 as const, ...pakistanAnswerVersion(initialAnswers), jeeVersion: 2 as const }));
    let nextAnswers: PartialAnswers = safeInitial;
    let nextStepIndex = startStepIndex;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = SavedCheckStateSchema.parse(JSON.parse(raw));
        // Entry keys separate drafts. Back may have changed degree or country;
        // the URL is an initial hint, never an override of the student's edits.
        const recovered = normalizeAnswers(upgradeSaudiAnswers({ ...saved.answers, ...(saved.answers?.curriculumType === "gce" ? {gceVersion: 1 as const} : {}), qualificationGuidanceVersion: 1, apsScopeVersion: 1 as const, apsTransitionVersion: 1 as const, dmatVersion: 1 as const, ...(saved.answers.curriculumType === 'ib' ? {ibVersion:1 as const} : {}), indiaStudyRouteVersion: 1 as const, ...pakistanAnswerVersion(saved.answers), jeeVersion: 2 as const }));
        nextAnswers = recovered;
        nextStepIndex = restoredStepIndex(recovered, saved.stepIndex ?? startStepIndex, saved.stepId);
        const historyStep = window.history.state?.[CHECK_HISTORY_STEP_KEY];
        if (typeof historyStep === "number" && Number.isInteger(historyStep) && historyStep >= 0) {
          // A history remount can happen before the outgoing draft effect saves.
          nextStepIndex = restoredStepIndex(recovered, historyStep);
        } else if (entryDegree === recovered.targetDegree && nextStepIndex === 0) {
          nextStepIndex = nextEntryStep(recovered);
        }
      }
    } catch {
      nextAnswers = safeInitial;
      nextStepIndex = startStepIndex;
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
  }, [initialAnswers, startStepIndex, storageKey, entryDegree]);

  const steps = visibleSteps(answers);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;
  const canContinue = isAnswered(answers, step);
  const questionCopy = questionFor(step, answers);
  const numberStep = isNumberStep(step) ? NUMBER_STEPS[step] : null;
  const numberError =
    isNumberStep(step) && answers[step] !== undefined && !canContinue
      ? numberStep!.error
      : null;

  useEffect(() => {
    if (!restored) return;
    const safeStepIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0));
    sessionStorage.setItem(
      activeStorageKey.current,
      JSON.stringify({
        answers,
        stepIndex: safeStepIndex,
        stepId: steps[safeStepIndex],
      } satisfies SavedCheckState),
    );
    // Next can replace custom history state while committing a traversal.
    // Reattach the displayed question and active URL after that commit.
    window.history.replaceState(
      { ...(window.history.state ?? {}), [CHECK_HISTORY_STEP_KEY]: safeStepIndex },
      "",
      activeEntryUrl.current ?? window.location.href,
    );
  }, [answers, restored, stepIndex, steps, storageKey]);

  useEffect(() => {
    if (!restored) return;
    function onPopState(event: PopStateEvent) {
      const historyStep = event.state?.[CHECK_HISTORY_STEP_KEY];
      if (typeof historyStep !== "number" || !Number.isInteger(historyStep)) return;
      const safeStepIndex = restoredStepIndex(answers, Math.max(historyStep, 0));
      // Older question entries can still contain the original landing degree.
      // Keep the active edited draft and URL together across Back and Forward.
      if (activeEntryUrl.current && window.location.href !== activeEntryUrl.current) {
        window.history.replaceState(
          { ...event.state, [CHECK_HISTORY_STEP_KEY]: safeStepIndex },
          "",
          activeEntryUrl.current,
        );
      }
      setError(null);
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
    if (entryDegree && stepId === "targetDegree" && value !== answers.targetDegree &&
      (value === "bachelor" || value === "master")) {
      // A refresh follows the edited degree; a later landing choice resumes
      // that degree's own draft. A discarded school hint cannot return as issuer.
      const url = new URL(window.location.href);
      url.searchParams.set("degree", value);
      url.searchParams.delete("country");
      activeEntryUrl.current = url.href;
      window.history.replaceState(window.history.state, "", url);
      activeStorageKey.current = `${CHECK_STORAGE_PREFIX}:none:${value}`;
    }
    setAnswers((prev) =>
      withAnswer(prev, stepId, value as Answers[typeof stepId]),
    );
  }

  function back() {
    setError(null);
    if (stepIndex > 0) {
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
      const nextStepIndex = nextEntryStep(answers, stepIndex);
      setStepIndex(nextStepIndex);
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
                step={step === "priorDegreeYears" || step === "yearsOfUniversityStudy" || step === "schoolGradePercent" ? "any" : undefined}
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
          {step === 'schoolGradePercent' && isPakistanBranch(answers) && <button type="button" aria-pressed={answers[step]===null} onClick={()=>select(step,null)}>Cannot confirm overall percentage</button>}
          {answers.ibVersion===1 && ['ibExamYear','ibSchoolYears','ibTotalPoints'].includes(step) && <button type="button" aria-pressed={answers[step]===null} onClick={()=>select(step,null)}>Cannot confirm</button>}
            {step === "yearsOfUniversityStudy" && (isIndiaStudyBranch(answers) || isSaudiStudyBranch(answers) || isPakistanBranch(answers)) && <button type="button" aria-pressed={answers[step] === null} onClick={() => select(step, null)}>Cannot establish successful academic years</button>}
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

        {isLast&&<ProcessContextEditor answers={answers} onChange={setAnswers}/>}
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
