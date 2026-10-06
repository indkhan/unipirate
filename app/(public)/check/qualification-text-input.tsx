import styles from "./check.module.css";
import { TEXT_STEPS } from "./steps";

/** Shared text controls for the checker and saved-profile review. */
export function QualificationTextInput({ step, value, onChange }: {
  step: keyof typeof TEXT_STEPS;
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const config = TEXT_STEPS[step];
  return (
    <div>
      <label className={styles.inputLabel} htmlFor={`${step}-input`}>{config.label}</label>
      <input id={`${step}-input`} className={styles.input} type="text"
        maxLength={config.maxLength} value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)} />
    </div>
  );
}
