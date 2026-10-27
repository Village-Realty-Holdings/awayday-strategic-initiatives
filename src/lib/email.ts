import { Resend } from "resend";

// Server-side email via Resend. Mirrors the AI helper: degrades gracefully when
// no key is set, so review cycles still run (links are shown in-app to copy by
// hand) until Awayday provisions a verified sending domain.
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sender address. Two things here are deliberate.
 *
 * The DEFAULT is a verified domain. The previous default, noreply@awayday.com,
 * is not verified in Resend and never has been, so every message sent under it
 * was rejected (single send) or accepted-and-dropped (batch). That silently
 * swallowed 105 notifications between 2026-07-21 and 08-20.
 *
 * The fallback uses `||`, not `??`, so an EMPTY string falls back too. An env
 * var that exists but is blank is a real failure mode (a mis-set value in a
 * dashboard or CLI) and `??` would happily send with an empty From.
 */
const FROM = process.env.EMAIL_FROM?.trim() || "Awayday <notifications@mail.vacationhr.com>";

let client: Resend | null = null;
function getClient(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error("Email is not configured. Add RESEND_API_KEY.");
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** One copy address. Optional. */
  cc?: string;
}): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "Email is not configured." };
  try {
    // Send multipart (HTML + plain text). A text alternative materially improves
    // deliverability; spam filters penalise HTML-only mail.
    const { data, error } = await getClient().emails.send({ from: FROM, to: [to], subject, html, text, replyTo, ...(cc ? { cc: [cc] } : {}) });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." };
  }
}
