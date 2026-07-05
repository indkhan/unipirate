

/* Empty state — calm, informative, one action. The glyph is a hollow
   station dot: "no stops recorded yet", not a sad illustration. */

function EmptyState({ title, body, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 'var(--space-3)', padding: 'var(--space-7) var(--space-5)',
      border: '1.5px dashed var(--line-strong)', borderRadius: 'var(--radius-card)',
      background: 'var(--surface)', fontFamily: 'var(--font-body)',
    }}>
      <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '2.5px solid var(--line-strong)', background: 'var(--surface)', boxSizing: 'border-box' }}></span>
      <div style={{ font: 'var(--text-heading)', fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{title}</div>
      {body && <div style={{ font: 'var(--text-body-sm)', color: 'var(--ink-secondary)', maxWidth: '360px' }}>{body}</div>}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  );
}

module.exports = { EmptyState };
