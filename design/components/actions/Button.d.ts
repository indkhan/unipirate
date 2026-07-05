/**
 * @startingPoint section="Actions" subtitle="Primary, secondary, quiet and danger buttons" viewport="700x220"
 */
export interface ButtonProps {
  /** Visual weight. Primary = Route Blue, one per screen region. */
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  /** md = 48px tap target (default, mobile-safe); sm = 40px, desktop-dense UI only. */
  size?: 'md' | 'sm';
  /** Stretch to container width — the default pattern on mobile. */
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  /** Sentence-case label. No emoji, no exclamation marks. */
  children: React.ReactNode;
}
