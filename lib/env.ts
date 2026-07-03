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

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function getClientEnv(): ClientEnv {
  return clientSchema.parse(runtimeEnv);
}

export function getServerEnv(): ServerEnv {
  return serverSchema.parse(runtimeEnv);
}
