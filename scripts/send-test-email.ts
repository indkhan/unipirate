// Sends a test email via Resend.
// Usage: pnpm email:test you@example.com
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const to = process.argv[2];

if (!apiKey) {
  console.error("RESEND_API_KEY is not set (put it in .env.local).");
  process.exit(1);
}
if (!to) {
  console.error("Usage: pnpm email:test you@example.com");
  process.exit(1);
}

const resend = new Resend(apiKey);

const { data, error } = await resend.emails.send({
  from: "UniPirate <onboarding@resend.dev>",
  to,
  subject: "UniPirate test email",
  text: "Resend is wired up correctly.",
});

if (error) {
  console.error("Send failed:", error);
  process.exit(1);
}
console.log("Sent:", data?.id);
