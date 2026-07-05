export interface InputProps {
  /** Field label, sentence case. */
  label: string;
  /** Help text below the field. Replaced by error when present. */
  hint?: string;
  /** Error message — red, plain, tells the user what to do. */
  error?: string;
  /** Render the value in mono — use for dates, IDs, file numbers. */
  mono?: boolean;
  placeholder?: string;
  type?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: any) => void;
  /** Shows "· required" after label; never an asterisk alone. */
  required?: boolean;
  disabled?: boolean;
}
