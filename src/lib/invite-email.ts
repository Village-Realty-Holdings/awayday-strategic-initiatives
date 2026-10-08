// Platform-level credentials email (Michael 8/13: admins invite people with
// specific permissions from People & access, no developer in the loop).
// Client-facing copy: no em dashes. HTML + plain-text parts (deliverability).

function shell(bodyHtml: string): string {
  return `
  <div style="margin:0;padding:0;background:#f4f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="font-size:15px;font-weight:600;color:#2D4447;letter-spacing:-0.01em;margin-bottom:24px;">Awayday</div>
      <div style="background:#ffffff;border:1px solid #e3e8e8;border-radius:12px;padding:28px;">
        ${bodyHtml}
      </div>
      <p style="margin:18px 4px 0;font-size:11px;color:#9aa8a9;">Awayday, confidential. You received this because an administrator set up your access.</p>
    </div>
  </div>`;
}

const button = (url: string, label: string) =>
  `<a href="${url}" style="display:inline-block;background:#2D4447;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${label}</a>`;

// User-derived strings must never carry markup into the HTML part.
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const firstName = (name: string | null) => (name ? name.split(/\s+/)[0] : null);

export type PlatformInviteArgs = {
  name: string | null;
  email: string;
  tempPassword: string;
  appUrl: string;
  /** Display names of the applications granted, e.g. ["Talent", "eNPS"]. */
  appNames: string[];
};

export function buildPlatformInviteEmail(a: PlatformInviteArgs): { subject: string; html: string; text: string } {
  const hi = firstName(a.name) ? `Hi ${esc(firstName(a.name)!)},` : "Hi,";
  const subject = "Your Awayday platform login";
  const appsLine =
    a.appNames.length > 0
      ? `You have access to: ${a.appNames.join(", ")}.`
      : "An administrator will grant your application access shortly.";
  const body = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#243b3e;">${hi}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#243b3e;">An account has been set up for you on the Awayday platform. ${esc(appsLine)}</p>
    <table role="presentation" style="margin:0 0 20px;font-size:14px;color:#243b3e;">
      <tr><td style="padding:2px 12px 2px 0;color:#5a6e70;">Email</td><td style="font-weight:600;">${esc(a.email)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#5a6e70;">Temporary password</td><td style="font-weight:600;font-family:ui-monospace,Menlo,monospace;">${a.tempPassword}</td></tr>
    </table>
    ${button(`${a.appUrl}/login`, "Log in")}
    <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#8a9a9b;">On first login you will set up two-factor authentication with an authenticator app and can change your password under Settings.</p>`;
  const text = `${hi}\n\nAn account has been set up for you on the Awayday platform. ${appsLine}\n\nEmail: ${a.email}\nTemporary password: ${a.tempPassword}\n\nLog in: ${a.appUrl}/login\n\nOn first login you will set up two-factor authentication with an authenticator app and can change your password under Settings.\n\nAwayday, confidential.`;
  return { subject, html: shell(body), text };
}
