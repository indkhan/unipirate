"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState, type ReactNode } from "react";

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

type ProfileReviewProps = {
  countries: { code: string; name: string }[];
  boards: { countryCode: string; label: string }[];
  initialAnswers: PartialAnswers;
  userMenu?: ReactNode;
};

type Option = { value: unknown; label: string; key: string };

const QUESTIONS: Record<StepId, string> = {
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
  targetField: "Study field",
  intake: "Intake",
};

const emptySubject: GceSubjectAnswer = {
  subjectId: "mathematics",
  level: "AL",
  grade: "A",
};

export function ProfileReview({
  countries,
  boards,
  initialAnswers,
  userMenu,
}: ProfileReviewProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [answers, setAnswers] = useState<PartialAnswers>(initialAnswers);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const steps = visibleSteps(answers);
  const complete = steps.every((step) => isAnswered(answers, step));

  function optionsFor(stepId: StepId): Option[] {
    switch (stepId) {
      case "targetDegree":
        return [
          { value: "bachelor", label: "Bachelor's", key: "bachelor" },
          { value: "master", label: "Master's", key: "master" },
        ];
      case "nationality":
      case "certificateCountry":
        return countries
          .filter((c) => c.code !== "de")
          .map((c) => ({ value: c.code, label: c.name, key: c.code }));
      case "visaApplicationCountry":
        return [
          ...countries
            .filter((c) => c.code !== "de")
            .map((c) => ({ value: c.code, label: c.name, key: c.code })),
          { value: "other", label: "Another country", key: "other" },
        ];
      case "curriculumType":
        return [
          { value: "national", label: "National board", key: "national" },
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
    if (step === "schoolGradePercent") {
      return (
        <div className={styles.percentInputWrap}>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            placeholder="85"
            value={answers.schoolGradePercent ?? ""}
            onChange={(event) =>
              select(
                "schoolGradePercent",
                event.target.value === "" ? undefined : Number(event.target.value),
              )
            }
          />
          <span className={styles.percentSuffix}>%</span>
        </div>
      );
    }

    if (step === "gceSubjects") {
      const subjects = answers.gceSubjects ?? [];
      return (
        <div className={styles.options}>
          {subjects.map((subject, index) => (
            <div key={index} className={styles.subjectRow}>
              <div className={styles.subjectSelects}>
                <select
                  className={styles.select}
                  value={subject.subjectId}
                  aria-label="Subject"
                  onChange={(event) => {
                    const next = subjects.slice();
                    next[index] = {
                      ...subject,
                      subjectId: event.target.value as GceSubjectAnswer["subjectId"],
                    };
                    select("gceSubjects", next);
                  }}
                >
                  {GCE_SUBJECTS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={subject.level}
                  aria-label="Level"
                  onChange={(event) => {
                    const next = subjects.slice();
                    next[index] = {
                      ...subject,
                      level: event.target.value as "AL" | "AS",
                    };
                    select("gceSubjects", next);
                  }}
                >
                  <option value="AL">A-Level</option>
                  <option value="AS">AS</option>
                </select>
                <select
                  className={styles.select}
                  value={subject.grade}
                  aria-label="Grade"
                  onChange={(event) => {
                    const next = subjects.slice();
                    next[index] = {
                      ...subject,
                      grade: event.target.value as GceSubjectAnswer["grade"],
                    };
                    select("gceSubjects", next);
                  }}
                >
                  {GCE_GRADES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => select("gceSubjects", [...subjects, { ...emptySubject }])}
          >
            + Add subject
          </button>
        </div>
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
          {userMenu ? <div className={styles.userMenu}>{userMenu}</div> : null}
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
              <h2>{QUESTIONS[step]}</h2>
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
