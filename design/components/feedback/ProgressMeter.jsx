

/* Progress meter — "n of m" bar for document/application counts.
   Fill is Route Blue (progress = journey). Counts in mono. */

function ProgressMeter({ value, max, label }) {
  value = Number(value); max = Number(max);
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <span style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-secondary)' }}>{value} of {max}</span>
      </div>
      <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} style={{ height: '8px', background: 'var(--paper-sunken)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--route-blue)', borderRadius: '4px', transition: 'width var(--dur-2) var(--ease)' }}></div>
      </div>
    </div>
  );
}

module.exports = { ProgressMeter };
