// The applications a user can launch from the post-login home (Jakob, 2026-06-15:
// "log in and click into the application you want … if you have access").
// Entitlement is per-user (User.appAccess); admins always have everything.

// This app was extracted from the multi-app Awayday platform; the registry keeps
// its shape so per-user entitlement (User.appAccess) still works.
export type AppKey = "initiatives";

export type AppDef = {
  key: AppKey;
  name: string;
  href: string;
  tagline: string;
  blurb: string;
  // Dark-launch: hidden apps never appear in the launcher or nav switcher,
  // regardless of role. Access is by direct URL + entitlement only, until the
  // module is announced and the flag is removed.
  hidden?: boolean;
};

export const APPS: AppDef[] = [
  {
    key: "initiatives",
    name: "Strategic Initiatives",
    href: "/",
    tagline: "The value-creation plan",
    blurb: "Track strategic initiatives, the CIM risk register, and progress toward the $150M EBITDA goal.",
  },
];

// Admins always see everything; otherwise filter to the user's granted apps.
// Hidden (dark-launched) apps are excluded for everyone — direct URL only.
// `apps` is injectable so tests can exercise the hidden mechanism with a fixture.
export function accessibleApps(role: string | null | undefined, appAccess: string[] | null | undefined, apps: AppDef[] = APPS): AppDef[] {
  const visible = apps.filter((a) => !a.hidden);
  if (role === "admin") return visible;
  const allowed = new Set(appAccess ?? []);
  return visible.filter((a) => allowed.has(a.key));
}

export function hasApp(role: string | null | undefined, appAccess: string[] | null | undefined, key: AppKey): boolean {
  if (role === "admin") return true;
  return (appAccess ?? []).includes(key);
}
