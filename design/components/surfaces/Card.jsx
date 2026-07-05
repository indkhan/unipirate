

function Card({ title, action, children, padding = 'var(--space-5)' }) {
  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        padding,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        fontFamily: 'var(--font-body)',
        color: 'var(--ink)',
      }}
    >
      {(title || action) && (
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          {title && <h3 style={{ margin: 0, font: 'var(--text-title)', color: 'var(--ink)' }}>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

module.exports = { Card };
