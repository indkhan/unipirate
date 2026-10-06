import styles from "./check.module.css";
import { isAnswered, TEXT_STEPS } from "./steps";

/** Shared text controls for the checker and saved-profile review. */
export function QualificationTextInput({ step, value, onChange }: {
  step: keyof typeof TEXT_STEPS;
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const config = TEXT_STEPS[step];
  const invalid = step === "apsSubmissionDate" && value !== undefined && !isAnswered({apsSubmissionDate: value}, step);
  return (
    <div>
      <label className={styles.inputLabel} htmlFor={`${step}-input`}>{config.label}</label>
      <input id={`${step}-input`} className={styles.input} type="text"
        placeholder={step === "apsSubmissionDate" ? "YYYY-MM-DD" : undefined}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${step}-error` : undefined}
        maxLength={config.maxLength} value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)} />
      {invalid && <p id={`${step}-error`} className={styles.fieldError}>Enter a real calendar date in YYYY-MM-DD format.</p>}
    </div>
  );
}
