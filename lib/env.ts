import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
});

const serverSchema = clientSchema.extend({
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  RESEND_API_KEY: z.string().min(1).optional(),
});

// NEXT_PUBLIC_ vars must be referenced literally so Next.js inlines them
// into the client bundle.
const runtimeEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};

// Server-only vars are validated only on the server; in the browser they are
// absent by design. The cast keeps one `env` object with full typing —
// accessing a server var from client code returns undefined, so don't.
export const env = (
  typeof window === "undefined" ? serverSchema : clientSchema
).parse(runtimeEnv) as z.infer<typeof serverSchema>;
