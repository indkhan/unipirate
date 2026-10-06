"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/app/theme-toggle";

import { submitCheck } from "./actions";
import styles from "./check.module.css";
import { buildOptions, type Option } from "./check-questions";
import { QualificationTextInput } from "./qualification-text-input";
import { GceSubjectsEditor } from "./gce-subjects-editor";
import { IbSubjectsEditor } from "./ib-subjects-editor";
import {
  NUMBER_STEPS,
  PartialAnswersSchema,
  normalizeAnswers,
  isAnswered,
  isNumberStep,
  isTextStep,
  visibleSteps,
  withAnswer,
  type Answers,
  type PartialAnswers,
  type StepId,
} from "./steps";

type ProfileReviewProps = {
  initialAnswers: PartialAnswers;
  userMenu?: ReactNode;
};

const QUESTIONS: Record<StepId, string> = {
  schoolQualificationCountry: "School qualification issuer country",
  schoolQualificationContext: "School qualification context",
  apsApplicationContext: "uni-assist application context",
  visaMissionContext: "Confirmed visa checklist context",
  hasPriorUniversityStudy: "Previous higher education",
  priorQualificationType: "Previous qualification type",
  priorStudyInstitution: "Previous institution",
  priorStudyCountry: "Awarding institution country",
  priorStudyCountryOther: "Other awarding country",
  priorQualificationContext: "Qualification education system",
  priorStudyField: "Previous study field",
  priorDegreeYears: "Qualification duration",
  yearsOfUniversityStudy: "Successfully completed study",
  priorStudyCompletion: "Study completion status",
  targetDegree: "Study level",
  nationality: "Nationality",
  certificateCountry: "Certificate country",
  visaApplicationCountry: "Visa application country",
  curriculumType: "Curriculum",
  board: "Board",
  schoolGradePercent: "Class 12 result",
  jeeAdvanced: "JEE Advanced",
  hasExistingApsCertificate: "APS certificate",
  gceAwardingBody: "A-Level awarding body",
  gceSubjects: "A-Level subjects",
  ibFullDiploma: "Full IB Diploma",
  ibExamYear: "IB exam year",
  ibSchoolYears: "School years",
  ibTotalPoints: "IB total points",
  ibSubjects: "IB subjects",
  ibMathCourse: "IB Mathematics course",
  targetField: "Study field",
  intake: "Intake",
};

export function ProfileReview({ initialAnswers, userMenu }: ProfileReviewProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [answers, setAnswers] = useState<PartialAnswers>(() => normalizeAnswers({ ...PartialAnswersSchema.parse(initialAnswers), apsScopeVersion: 1 }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const steps = visibleSteps(answers);
  const complete = steps.every((step) => isAnswered(answers, step));

  // One options source with the checker (the local copy predated the IB steps
  // and silently rendered them optionless).
  const optionsFor = (stepId: StepId): Option[] => buildOptions(stepId, answers);

  function currentKey(stepId: StepId): string | undefined {
    const value = answers[stepId];
    if (value === undefined) return undefined;
    if (stepId === "intake") {
      return value === null
        ? "unsure"
        : `${(value as { term: string; year: number }).term}-${(value as { term: string; year: number }).year}`;
    }
    if (typeof value === "boolean") return value ? "yes" : "no";
    return String(value);
  }

  function select(stepId: StepId, value: unknown) {
    setError(null);
    setAnswers((prev) =>
      withAnswer(prev, stepId, value as Answers[typeof stepId]),
    );
  }

  async function submit() {
    setError(null);
    if (!complete) {
      setError("Some answers are missing. Complete them before evaluating.");
      return;
    }
    setSubmitting(true);
    const outcome = await submitCheck(answers);
    if ("error" in outcome) {
      setSubmitting(false);
      setError(outcome.error);
      return;
    }
    posthog.capture("profile_check_updated", { check_id: outcome.id });
    router.push(`/result/${outcome.id}`);
  }

  function field(step: StepId) {
    if (isTextStep(step)) {
      return <QualificationTextInput step={step} value={answers[step]} onChange={(value) => select(step, value)} />;
    }
    if (isNumberStep(step)) {
      const config = NUMBER_STEPS[step];
      return (
        <div className={styles.percentInputWrap}>
          <input
            className={styles.input}
            aria-labelledby={`${step}-label`}
            type="number"
            inputMode="decimal"
            step={step === "priorDegreeYears" || step === "yearsOfUniversityStudy" ? "any" : undefined}
            min={config.min}
            max={config.max}
            placeholder={config.placeholder}
            value={answers[step] ?? ""}
            onChange={(event) =>
              select(
                step,
                event.target.value === "" ? undefined : Number(event.target.value),
              )
            }
          />
          {"suffix" in config && (
            <span className={styles.percentSuffix}>{config.suffix}</span>
          )}
        </div>
      );
    }

    if (step === "gceSubjects") {
      return (
        <GceSubjectsEditor
          subjects={answers.gceSubjects ?? []}
          onChange={(next) => select("gceSubjects", next)}
        />
      );
    }

    if (step === "ibSubjects") {
      return (
        <IbSubjectsEditor
          subjects={answers.ibSubjects ?? []}
          onChange={(next) => select("ibSubjects", next)}
        />
      );
    }

    return (
      <div className={styles.reviewOptions}>
        {optionsFor(step).map((option) => {
          const selected = currentKey(step) === option.key;
          return (
            <button
              key={option.key}
              type="button"
              className={`${styles.reviewChoice} ${
                selected ? styles.reviewChoiceSelected : ""
              }`}
              aria-pressed={selected}
              onClick={() => select(step, option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.push("/dashboard")}
          >
            ‹ Dashboard
          </button>
          <span className={styles.brand}>UniPirate</span>
          <div className={styles.headerActions}>
            <ThemeToggle />
            {userMenu ? <div className={styles.userMenu}>{userMenu}</div> : null}
          </div>
        </div>
      </header>

      <main className={`${styles.main} ${styles.reviewMain}`}>
        <div>
          <h1 className={styles.question}>Your profile check</h1>
          <p className={styles.subtitle}>
            Change any answer, then evaluate again. Your dashboard updates from
            the saved profile.
          </p>
        </div>

        <div className={styles.reviewGrid}>
          {steps.map((step) => (
            <section className={styles.reviewCard} key={step}>
              <h2 id={`${step}-label`}>{QUESTIONS[step]}</h2>
              {field(step)}
              {!isAnswered(answers, step) ? (
                <span className={styles.reviewMissing}>Required</span>
              ) : null}
            </section>
          ))}
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <button
          type="button"
          className={styles.cta}
          disabled={!complete || submitting}
          onClick={submit}
        >
          {submitting ? "Updating your path..." : "Evaluate updated profile"}
        </button>
      </main>
    </div>
  );
}
