

/* Task checklist item — the dashboard's workhorse. Checked = Route Blue
   (progress is blue; green is reserved for verification). */

function ChecklistItem({ label, detail, checked = false, onToggle, deadline, verified }) {
  return (
    <div
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle && onToggle(); } }}
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'flex-start',
        padding: 'var(--space-3) var(--space-4)',
        minHeight: 'var(--tap-min, 48px)',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-control)',
        cursor: onToggle ? 'pointer' : 'default',
        fontFamily: 'var(--font-body)',
        transition: 'border-color var(--dur-1) var(--ease)',
      }}
    >
      <span
        style={{
          width: '22px', height: '22px', flex: 'none', marginTop: '1px',
          borderRadius: 'var(--radius-control)',
          border: checked ? '1px solid var(--route-blue)' : '1.5px solid var(--line-strong)',
          background: checked ? 'var(--route-blue)' : 'var(--surface)',
          color: 'var(--ink-inverse)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700,
          transition: 'background-color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease)',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
        <span style={{ font: 'var(--text-body)', fontWeight: 500, color: checked ? 'var(--ink-muted)' : 'var(--ink)', textDecoration: checked ? 'line-through' : 'none', textDecorationColor: 'var(--line-strong)' }}>
          {label}
        </span>
        {detail && <span style={{ font: 'var(--text-body-sm)', color: 'var(--ink-secondary)' }}>{detail}</span>}
        {(deadline || verified) && (
          <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
            {deadline}
            {verified}
          </span>
        )}
      </span>
    </div>
  );
}

module.exports = { ChecklistItem };
