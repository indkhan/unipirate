"use client";

import styles from "./check.module.css";
import { hasDuplicateSubjects } from "./steps";

type SubjectRow = { subjectId: string; level: string; grade: string };

/**
 * Add/remove subject rows with a subject, level and grade select each. GCE and
 * IB differ only in the three option lists, so they share this component.
 */
export function SubjectRowsEditor<T extends SubjectRow>({
  subjects,
  onChange,
  catalog,
  levels,
  grades,
  gradeLabel = (grade) => grade,
  noun,
}: {
  subjects: T[];
  onChange: (subjects: T[]) => void;
  catalog: readonly { id: string; label: string }[];
  levels: readonly { value: string; label: string }[];
  grades: readonly string[];
  gradeLabel?: (grade: string) => string;
  /** Singular, unarticled — "subject" becomes "a subject" / "another subject". */
  noun: string;
}) {
  // `as T` on each patch: the select options come from the same catalog, level
  // and grade lists that typed T, but TS cannot narrow a string back to them.
  const patch = (index: number, subject: T, changes: Partial<SubjectRow>) => {
    const next = subjects.slice();
    next[index] = { ...subject, ...changes } as T;
    onChange(next);
  };

  return (
    <div className={styles.options}>
      {subjects.map((s, i) => (
        <div key={i} className={styles.subjectRow}>
          <div className={styles.subjectSelects}>
            <select
              className={styles.select}
              aria-label="Subject"
              value={s.subjectId}
              onChange={(e) => patch(i, s, { subjectId: e.target.value })}
            >
              {catalog.map((c) => (
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
              onChange={(e) => patch(i, s, { level: e.target.value })}
            >
              {levels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              aria-label="Grade"
              value={s.grade}
              onChange={(e) => patch(i, s, { grade: e.target.value })}
            >
              {grades.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
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
        disabled={subjects.length >= catalog.length}
        onClick={() =>
          onChange([...subjects, nextRow(subjects, catalog, levels, grades)])
        }
      >
        + Add {subjects.length === 0 ? `a ${noun}` : `another ${noun}`}
      </button>
      {hasDuplicateSubjects(subjects) && (
        <p className={styles.fieldError}>Add each subject only once.</p>
      )}
    </div>
  );
}

function nextRow<T extends SubjectRow>(
  subjects: T[],
  catalog: readonly { id: string }[],
  levels: readonly { value: string }[],
  grades: readonly string[],
): T {
  const used = new Set(subjects.map((subject) => subject.subjectId));
  const subject = catalog.find((candidate) => !used.has(candidate.id));
  return {
    subjectId: subject?.id ?? catalog[0].id,
    level: levels[0].value,
    grade: grades[0],
  } as T;
}
