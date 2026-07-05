const { useState } = React;

function Button({ variant = 'primary', size = 'md', fullWidth = false, disabled = false, type = 'button', onClick, children }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const base = {
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: size === 'sm' ? '14px' : '16px',
    letterSpacing: '0.01em',
    minHeight: size === 'sm' ? '40px' : 'var(--tap-min, 48px)',
    padding: size === 'sm' ? '0 14px' : '0 20px',
    borderRadius: 'var(--radius-control)',
    border: '1px solid transparent',
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    outline: focus ? '3px solid var(--focus-ring)' : 'none',
    outlineOffset: '1px',
    transition: 'background-color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease)',
  };
  const variants = {
    primary: {
      background: hover && !disabled ? 'var(--route-blue-hover)' : 'var(--route-blue)',
      color: 'var(--ink-inverse)',
    },
    secondary: {
      background: hover && !disabled ? 'var(--route-blue-tint)' : 'var(--surface)',
      color: 'var(--route-blue)',
      borderColor: 'var(--line-strong)',
    },
    quiet: {
      background: hover && !disabled ? 'var(--route-blue-tint)' : 'transparent',
      color: 'var(--route-blue)',
    },
    danger: {
      background: hover && !disabled ? '#9A1F18' : 'var(--danger)',
      color: 'var(--ink-inverse)',
    },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{ ...base, ...variants[variant] }}
    >
      {children}
    </button>
  );
}

module.exports = { Button };
