"use client";

import styles from "./check.module.css";
import {
  GCE_GRADES,
  GCE_SUBJECTS,
  hasDuplicateGceSubjects,
  type GceSubjectAnswer,
} from "./steps";

const emptySubject: GceSubjectAnswer = {
  subjectId: "mathematics",
  level: "AL",
  grade: "A",
};

function nextSubject(subjects: GceSubjectAnswer[]): GceSubjectAnswer {
  const used = new Set(subjects.map((subject) => subject.subjectId));
  const subject = GCE_SUBJECTS.find((candidate) => !used.has(candidate.id));
  return { ...emptySubject, subjectId: subject?.id ?? emptySubject.subjectId };
}

export function GceSubjectsEditor({
  subjects,
  onChange,
}: {
  subjects: GceSubjectAnswer[];
  onChange: (subjects: GceSubjectAnswer[]) => void;
}) {
  return (
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
                onChange(next);
              }}
            >
              {GCE_SUBJECTS.map((c) => (
                <option
                  disabled={subjects.some(
                    (subject, subjectIndex) =>
                      subjectIndex !== i && subject.subjectId === c.id,
                  )}
                  key={c.id}
                  value={c.id}
                >
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
                onChange(next);
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
                onChange(next);
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
            onClick={() => onChange(subjects.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addBtn}
        disabled={subjects.length >= GCE_SUBJECTS.length}
        onClick={() => onChange([...subjects, nextSubject(subjects)])}
      >
        + Add {subjects.length === 0 ? "a subject" : "another subject"}
      </button>
      {hasDuplicateGceSubjects(subjects) && (
        <p className={styles.fieldError}>Add each subject only once.</p>
      )}
    </div>
  );
}
