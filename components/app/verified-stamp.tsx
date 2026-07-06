// The quality seal — the only place Verified Green lives.
// Chip variant ported from design/components/verification/VerifiedStamp.jsx.

const mono: React.CSSProperties = {
  fontFamily: "var(--font-wf-mono)",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.4,
};

export function VerifiedStamp({
  source,
  date,
  href,
}: {
  source: string;
  date?: string | null;
  href?: string | null;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "3px 10px 3px 5px",
        background: "var(--verified-tint)",
        border: "1px solid var(--verified-line)",
        borderRadius: "var(--radius-control)",
        ...mono,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "var(--verified)",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          flex: "none",
        }}
      >
        ✓
      </span>
      <span
        style={{
          color: "var(--verified)",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontSize: 11,
        }}
      >
        Verified
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "var(--ink-secondary)",
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            textUnderlineOffset: 3,
          }}
        >
          {source}
        </a>
      ) : (
        <span style={{ color: "var(--ink-secondary)" }}>{source}</span>
      )}
      {date ? <span style={{ color: "var(--ink-muted)" }}>· {date}</span> : null}
    </span>
  );
}
