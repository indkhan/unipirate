import type { OfferingVersion, CourseOffering } from "@/lib/courses/offerings";

export function ReviewedOfferings({ offerings }: { offerings: (Pick<CourseOffering, "intake_term" | "intake_year" | "applicant_group"> & Pick<OfferingVersion, "facts">)[] }) {
  if (!offerings.length) return null;
  return <section aria-label="Reviewed intake requirements">
    <h2>Reviewed intake requirements</h2>
    {offerings.map((o, index) => <article key={index}>
      <h3>{o.intake_term} {o.intake_year} · {o.applicant_group}</h3>
      {o.facts.map(f => <div key={f.key}>
        <p><strong>{f.key}</strong> · {f.status === "verified" ? "Reviewed fact" : "Unresolved — confirm with the official source"}</p>
        <p>{f.status === "verified" ? f.verbatim : null}</p>
        <p>Applies to: {f.applicability}</p>
        {f.status === "verified" && f.evidence.filter(e => e.last_verified_at).map((e, i) => <blockquote key={i}>
          <q>{e.source_quote}</q> · <a href={e.source_url} target="_blank" rel="noreferrer">Official source</a> · reviewed {e.last_verified_at}
        </blockquote>)}
      </div>)}
    </article>)}
  </section>;
}
