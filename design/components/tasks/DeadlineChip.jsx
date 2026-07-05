

/* Deadline chip — the ONLY home of Signal Amber. Date is always mono,
   DD MMM YYYY. Urgency ≤ 14 days shows the countdown; overdue goes danger. */

function DeadlineChip({ date, daysLeft, label = 'Deadline' }) {
  if (daysLeft !== undefined && daysLeft !== null) daysLeft = Number(daysLeft);
  const overdue = typeof daysLeft === 'number' && daysLeft < 0;
  const urgent = typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= 14;
  const palette = overdue
    ? { bg: 'var(--danger-tint)', border: 'rgba(179,38,30,0.35)', fg: 'var(--danger)', tick: 'var(--danger)' }
    : { bg: 'var(--signal-tint)', border: 'rgba(154,98,0,0.35)', fg: 'var(--signal)', tick: 'var(--signal-accent)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      padding: '3px 10px', borderRadius: 'var(--radius-control)',
      background: palette.bg, border: `1px solid ${palette.border}`,
      fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, lineHeight: 1.4,
    }}>
      <span style={{ width: '8px', height: '8px', flex: 'none', background: palette.tick, borderRadius: '1px' }}></span>
      <span style={{ color: palette.fg, fontWeight: 600, letterSpacing: 'var(--tracking-mono-label)', textTransform: 'uppercase', fontSize: '11px' }}>
        {overdue ? 'Overdue' : label}
      </span>
      <span style={{ color: 'var(--ink)' }}>{date}</span>
      {urgent && <span style={{ color: palette.fg }}>· {daysLeft === 0 ? 'today' : `${daysLeft}d left`}</span>}
      {overdue && <span style={{ color: palette.fg }}>· {Math.abs(daysLeft)}d ago</span>}
    </span>
  );
}

module.exports = { DeadlineChip };
