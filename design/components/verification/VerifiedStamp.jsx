

/* The quality seal. The ONLY place Verified Green lives.
   Reads as a stamp: seal glyph + source + last-verified date, all mono. */

function VerifiedStamp({ source, date, href, variant = 'chip' }) {
  const seal = (
    <span style={{ width: '16px', height: '16px', borderRadius: '999px', background: 'var(--verified)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flex: 'none' }}>✓</span>
  );
  const mono = { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, lineHeight: 1.4 };

  if (variant === 'stamp') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px', padding: '8px 12px', border: '1.5px solid var(--verified)', borderRadius: '4px', background: 'var(--verified-tint)', transform: 'rotate(-1.5deg)', ...mono }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--verified)', fontWeight: 600, letterSpacing: 'var(--tracking-mono-label)', textTransform: 'uppercase', fontSize: '11px' }}>{seal} Verified</span>
        <span style={{ color: 'var(--ink-secondary)' }}>{source}</span>
        <span style={{ color: 'var(--ink-muted)' }}>{date}</span>
      </div>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '3px 10px 3px 5px', background: 'var(--verified-tint)', border: '1px solid var(--verified-line)', borderRadius: 'var(--radius-control)', ...mono }}>
      {seal}
      <span style={{ color: 'var(--verified)', fontWeight: 600, letterSpacing: 'var(--tracking-mono-label)', textTransform: 'uppercase', fontSize: '11px' }}>Verified</span>
      {source && (
        <a href={href || '#'} style={{ color: 'var(--ink-secondary)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }} onClick={(e) => { if (!href) e.preventDefault(); }}>{source}</a>
      )}
      {date && <span style={{ color: 'var(--ink-muted)' }}>· {date}</span>}
    </span>
  );
}

module.exports = { VerifiedStamp };
