const { useState, useId } = React;

function Input({ label, hint, error, mono = false, placeholder, type = 'text', value, defaultValue, onChange, required = false, disabled = false }) {
  const [focus, setFocus] = useState(false);
  const id = useId();
  const borderColor = error ? 'var(--danger)' : focus ? 'var(--route-blue)' : 'var(--line-strong)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'var(--font-body)' }}>
      <label htmlFor={id} style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--ink)' }}>
        {label}
        {required && <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}> · required</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          font: mono ? 'var(--text-mono-data)' : 'var(--text-body)',
          fontSize: '16px', /* never smaller — avoids Android zoom-on-focus */
          color: 'var(--ink)',
          background: disabled ? 'var(--paper-sunken)' : 'var(--surface)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-control)',
          minHeight: 'var(--tap-min, 48px)',
          padding: '0 14px',
          outline: focus ? '3px solid var(--focus-ring)' : 'none',
          outlineOffset: '1px',
          transition: 'border-color var(--dur-1) var(--ease)',
        }}
      />
      {error ? (
        <div style={{ font: 'var(--text-body-sm)', color: 'var(--danger)' }}>{error}</div>
      ) : hint ? (
        <div style={{ font: 'var(--text-body-sm)', color: 'var(--ink-secondary)' }}>{hint}</div>
      ) : null}
    </div>
  );
}

module.exports = { Input };
