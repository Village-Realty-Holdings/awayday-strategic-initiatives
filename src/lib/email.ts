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
  /** One copy address (the LOI's deal lead, loi-email.ts). Optional. */
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

export type BatchEmail = { to: string; subject: string; html: string; text?: string; replyTo?: string };

/**
 * Send many emails in one API call per 100 (Resend's batch cap) instead of a
 * sequential loop, which trips Resend's 2-requests/second limit on large
 * cycles. Permissive validation: one bad address fails that email only, not
 * the whole batch. If the batch endpoint itself errors, falls back to paced
 * single sends so an activation is never lost to a transient failure. Returns
 * one result per input, aligned by index.
 */
export async function sendEmailBatch(
  emails: BatchEmail[],
  opts?: { idempotencyKey?: string },
): Promise<SendResult[]> {
  if (!emailConfigured()) return emails.map(() => ({ ok: false, error: "Email is not configured." }));
  const results: SendResult[] = new Array(emails.length);
  for (let start = 0; start < emails.length; start += 100) {
    const chunk = emails.slice(start, start + 100);
    try {
      const { data, error } = await getClient().batch.send(
        chunk.map((m) => ({ from: FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text, replyTo: m.replyTo })),
        {
          // STRICT, deliberately. Permissive validation is what let 105
          // notifications between 2026-07-21 and 08-20 be recorded as sent and
          // never delivered: the sending domain was not verified, and the batch
          // endpoint accepted them anyway, returning message ids and no errors.
          // The single-send endpoint rejects the same mail with a 403.
          //
          // Strict costs nothing we care about. If any message in the batch is
          // invalid the whole call throws, and the catch below already falls
          // back to paced single sends, where a bad RECIPIENT fails alone and a
          // bad SENDER fails loudly for every message. That is the behaviour
          // permissive was chosen to get, without the silent-success hole.
          batchValidation: "strict" as const,
          ...(opts?.idempotencyKey ? { idempotencyKey: `${opts.idempotencyKey}/${start}` } : {}),
        },
      );
      if (error) throw new Error(error.message);
      // Under strict validation there is no partial outcome: Resend either
      // accepts the whole batch or errors, which the catch below turns into
      // per-message single sends. So every message here succeeded.
      chunk.forEach((_, i) => {
        results[start + i] = { ok: true, id: data?.data?.[i]?.id ?? null };
      });
    } catch {
      // Paced fallback: stay under Resend's 2 req/s single-send limit.
      for (let i = 0; i < chunk.length; i++) {
        results[start + i] = await sendEmail(chunk[i]);
        if (i < chunk.length - 1) await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
  return results;
}
