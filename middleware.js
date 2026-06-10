import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request) {
  // No-op until Supabase env is configured, so the app runs before setup.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all routes except static assets and image files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
