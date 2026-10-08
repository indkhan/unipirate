// Pure shared boundary for server-selected evidence in one assistant response.
import { z } from "zod";
import { CalendarDateSchema } from "@/lib/engine/calendar-day";

const SourceSchema = z.object({
  slug: z.string().min(1), title: z.string(), content: z.string(),
  source_url: z.string().url().refine(url => /^https?:\/\//.test(url)),
  last_verified_at: z.string().datetime({ offset: true }).refine(value => CalendarDateSchema.safeParse(value.slice(0, 10)).success).nullable(),
  country_code: z.string().nullable(), ruleId: z.string().uuid(), versionId: z.string().uuid(),
  effectiveFrom: CalendarDateSchema.nullable(), effectiveUntil: CalendarDateSchema.nullable(),
  intakeFrom: z.number().int().nullable(), intakeUntil: z.number().int().nullable(),
  status: z.enum(["beta", "verified"]),
}).strict();
const EnvelopeSchema = z.object({
  chunks: z.array(SourceSchema),
  diagnostics: z.array(z.object({ ruleId: z.string().uuid(), versionId: z.string().uuid(),
    reason: z.enum(["missing_intake", "legacy_scope_unknown", "invalid_publication"]),
  }).strict()),
  note: z.string().optional(),
}).strict();
export type RuleSource = z.infer<typeof SourceSchema>;

/** Earlier responses never authorize this response's citations. Conflicting
 * evidence, including two versions of one slug, cannot identify one source. */
export function responseRuleSources(parts: readonly unknown[]): Map<string, RuleSource> {
  const sources = new Map<string, RuleSource>();
  const ambiguous = new Set<string>();
  for (const input of parts) {
    const part = z.object({ type: z.literal("tool-search_rules"), state: z.literal("output-available"), output: z.unknown() }).safeParse(input);
    if (!part.success) continue;
    const envelope = EnvelopeSchema.safeParse(part.data.output);
    if (!envelope.success) return new Map();
    for (const source of envelope.data.chunks) {
      const previous = sources.get(source.slug);
      if (previous && JSON.stringify(previous) !== JSON.stringify(source)) ambiguous.add(source.slug);
      sources.set(source.slug, source);
    }
  }
  for (const slug of ambiguous) sources.delete(slug);
  return sources;
}
