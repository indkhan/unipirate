import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/db/server";

/**
 * Completes every email or OAuth return: magic link, signup confirmation,
 * password reset and Google all land here.
 *
 * `@supabase/ssr` uses the PKCE flow, so Supabase sends back a `code` that has
 * to be exchanged for a session — `token_hash` + `type` only arrives from
 * older, non-PKCE email templates. Handling just one of the two silently fails
 * every link of the other kind.
 *
 * When Supabase rejects a link before redirecting back, it appends its own
 * `error_code` instead of a credential; that reason is passed through so the
 * login page can say the link expired rather than a generic failure.
 */
export async function completeAuthRedirect(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const fail = (reason: "expired" | "auth") =>
    NextResponse.redirect(`${origin}/login?error=${reason}`);
  const done = () => NextResponse.redirect(`${origin}${next}`);

  const errorCode = searchParams.get("error_code");
  if (errorCode) return fail(errorCode === "otp_expired" ? "expired" : "auth");

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // A PKCE exchange also fails when the link is opened in a different
    // browser than the one that requested it — the code verifier lives there.
    return error ? fail("expired") : done();
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    return error ? fail("expired") : done();
  }

  return fail("auth");
}
