export function courseProcessLocalConfig(env: Readonly<Record<string, string | undefined>>) {
  const api = env.COURSE_PROCESS_LOCAL_API ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = env.COURSE_PROCESS_LOCAL_PUBLIC_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = env.COURSE_PROCESS_LOCAL_SERVICE_KEY ?? env.SUPABASE_SECRET_KEY;
  const enabled = (api === "http://127.0.0.1:54321" || api === "http://127.0.0.1:55321") && !!publicKey && !!serviceKey;
  return { api, publicKey, serviceKey, enabled };
}
