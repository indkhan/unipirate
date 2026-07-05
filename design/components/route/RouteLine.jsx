

/* The signature element. Done = filled blue + check, current = "you are
   here" marker, upcoming = hollow. Green is never used here — the Route
   is blue; green belongs to verification. */

const KEYFRAMES_ID = 'uw-routeline-kf';
function ensureKeyframes() {
  if (typeof document === 'undefined' || document.getElementById(KEYFRAMES_ID)) return;
  const el = document.createElement('style');
  el.id = KEYFRAMES_ID;
  el.textContent = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes uw-here { 0% { box-shadow: 0 0 0 4px var(--route-blue-tint); } 60% { box-shadow: 0 0 0 9px rgba(31,79,191,0.10); } 100% { box-shadow: 0 0 0 4px var(--route-blue-tint); } }
  .uw-here-dot { animation: uw-here 2.4s var(--ease) infinite; }
}
.uw-here-dot { box-shadow: 0 0 0 4px var(--route-blue-tint); }`;
  document.head.appendChild(el);
}

function Dot({ state }) {
  ensureKeyframes();
  if (state === 'done') {
    return (
      <div style={{ width: '20px', height: '20px', borderRadius: 'var(--radius-round)', background: 'var(--route-blue)', color: 'var(--ink-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flex: 'none' }}>✓</div>
    );
  }
  if (state === 'current') {
    return (
      <div className="uw-here-dot" style={{ width: '20px', height: '20px', borderRadius: 'var(--radius-round)', background: 'var(--surface)', border: '5px solid var(--route-blue)', flex: 'none', boxSizing: 'border-box' }}></div>
    );
  }
  return (
    <div style={{ width: '14px', height: '14px', margin: '3px', borderRadius: 'var(--radius-round)', background: 'var(--surface)', border: '2px solid var(--line-strong)', flex: 'none', boxSizing: 'border-box' }}></div>
  );
}

function Seg({ solid, vertical }) {
  const style = vertical
    ? solid
      ? { width: '3px', flex: '1', background: 'var(--route-blue)', minHeight: '18px' }
      : { width: '0', flex: '1', borderLeft: '2px dashed var(--line-strong)', minHeight: '18px' }
    : solid
      ? { height: '3px', flex: '1', background: 'var(--route-blue)', minWidth: '12px' }
      : { height: '0', flex: '1', borderTop: '2px dashed var(--line-strong)', minWidth: '12px' };
  return <div style={style}></div>;
}

function RouteLine({
  stations = ['Eligibility', 'APS', 'Applications', 'Visa', 'Germany'],
  currentIndex = 0,
  orientation = 'horizontal',
  hereLabel = 'You are here',
}) {
  currentIndex = Number(currentIndex);
  const items = stations.map((s) => (typeof s === 'string' ? { label: s } : s));
  const stateOf = (i) => (i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo');

  if (orientation === 'vertical') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-display)' }}>
        {items.map((it, i) => {
          const st = stateOf(i);
          return (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', minHeight: i < items.length - 1 ? '64px' : 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px' }}>
                <Dot state={st} />
                {i < items.length - 1 && <Seg vertical solid={i + 1 <= currentIndex} />}
              </div>
              <div style={{ paddingBottom: 'var(--space-4)', paddingTop: '1px' }}>
                <div style={{ font: 'var(--text-heading)', color: st === 'todo' ? 'var(--ink-muted)' : 'var(--ink)' }}>{it.label}</div>
                {st === 'current' && (
                  <div style={{ font: 'var(--text-mono-label)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-mono-label)', textTransform: 'uppercase', color: 'var(--route-blue)', marginTop: '4px' }}>▸ {hereLabel}</div>
                )}
                {it.sub && <div style={{ font: 'var(--text-body-sm)', fontFamily: 'var(--font-body)', color: 'var(--ink-secondary)', marginTop: '4px' }}>{it.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', fontFamily: 'var(--font-display)' }}>
      {items.map((it, i) => {
        const st = stateOf(i);
        return (
          <div key={i} style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '20px' }}>
              <div style={{ flex: '1', display: 'flex', alignItems: 'center' }}>{i > 0 ? <Seg solid={i <= currentIndex} /> : <div style={{ flex: 1 }}></div>}</div>
            <Dot state={st} />
              <div style={{ flex: '1', display: 'flex', alignItems: 'center' }}>{i < items.length - 1 ? <Seg solid={i + 1 <= currentIndex} /> : <div style={{ flex: 1 }}></div>}</div>
            </div>
            <div style={{ font: 'var(--text-heading)', fontSize: '14px', color: st === 'todo' ? 'var(--ink-muted)' : 'var(--ink)', marginTop: '10px', textAlign: 'center', padding: '0 4px' }}>{it.label}</div>
            {st === 'current' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, letterSpacing: 'var(--tracking-mono-label)', textTransform: 'uppercase', color: 'var(--route-blue)', marginTop: '4px', whiteSpace: 'nowrap' }}>▸ {hereLabel}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

module.exports = { RouteLine };
