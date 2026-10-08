import { describe, it, expect } from "vitest";
import { buildPlatformInviteEmail } from "../../src/lib/invite-email";

// Michael 8/13: platform-wide invites from People & access. The credentials
// email is the only copy of the temp password once sent, so its contents are
// pinned here.

describe("buildPlatformInviteEmail", () => {
  const mail = buildPlatformInviteEmail({
    name: "Kenya Anderson",
    email: "kenya.anderson@awayday.com",
    tempPassword: "TempPw123!abc",
    appUrl: "https://awayday-app.vercel.app",
    appNames: ["Talent", "eNPS"],
  });

  it("carries credentials, login link, and granted apps in both parts", () => {
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain("kenya.anderson@awayday.com");
      expect(part).toContain("TempPw123!abc");
      expect(part).toContain("https://awayday-app.vercel.app/login");
      expect(part).toContain("Talent, eNPS");
    }
  });

  it("explains the no-apps state instead of listing nothing", () => {
    const none = buildPlatformInviteEmail({ name: null, email: "a@b.co", tempPassword: "x", appUrl: "https://x.co", appNames: [] });
    expect(none.text).toContain("will grant your application access");
  });

  it("escapes markup in user-derived strings (html part)", () => {
    const evil = buildPlatformInviteEmail({
      name: "<img src=x>",
      email: "a@b.co",
      tempPassword: "x",
      appUrl: "https://x.co",
      appNames: ["<script>"],
    });
    expect(evil.html).not.toContain("<img src=x>");
    expect(evil.html).not.toContain("<script>");
  });

  it("uses no em dashes in client-facing copy", () => {
    expect(mail.html).not.toContain("—");
    expect(mail.text).not.toContain("—");
  });
});
