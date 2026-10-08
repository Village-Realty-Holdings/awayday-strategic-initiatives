// The passwordless sign-in link email (Michael 9/11).
//
// Deliberately says as little as possible: it is sent to whoever asked, and the
// asker is not necessarily the mailbox owner, so it must not disclose what the
// address is connected to. No reviewee names, no cycle name, no indication of
// whether an account already existed. Just "someone asked, here is the link,
// ignore this if it wasn't you".
//
// Client-facing copy: no em dashes. HTML plus a plain-text alternative, same as
// the other templates.

function shell(bodyHtml: string): string {
  return `
  <div style="margin:0;padding:0;background:#f4f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="font-size:15px;font-weight:600;color:#2D4447;letter-spacing:-0.01em;margin-bottom:24px;">Awayday</div>
      <div style="background:#ffffff;border:1px solid #e3e8e8;border-radius:12px;padding:28px;">
        ${bodyHtml}
      </div>
      <p style="margin:18px 4px 0;font-size:11px;color:#9aa8a9;">Awayday, confidential.</p>
    </div>
  </div>`;
}

/** Minutes shown in the copy. Keep in step with magicLink's expiresIn in auth.ts. */
export const SIGN_IN_LINK_MINUTES = 30;

/**
 * The sign-in link email. `url` comes from the auth plugin and already carries
 * the one-time token and the destination the person was heading to.
 */
export function buildSignInLinkEmail({ url }: { url: string }): { subject: string; html: string; text: string } {
  const subject = "Your Awayday sign-in link";
  const lead = `Use the button below to sign in. No password needed. The link works once and expires in ${SIGN_IN_LINK_MINUTES} minutes.`;
  const ignore = "If you did not ask to sign in, you can ignore this email. Nothing happens until the link is used.";
  const body = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#243b3e;">Hi,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#243b3e;">${lead}</p>
    <a href="${url}" style="display:inline-block;background:#2D4447;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">Sign in</a>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#8a9a9b;">${ignore}</p>`;
  const text = `Hi,\n\n${lead}\n\n${url}\n\n${ignore}\n\nAwayday, confidential.`;
  return { subject, html: shell(body), text };
}
