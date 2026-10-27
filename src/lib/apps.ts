// Per-user app entitlement (User.appAccess); admins always have everything.
// Users without the grant are sent to /no-access (see the (app) layout and requireApp).

// This app was extracted from the multi-app Awayday platform; the registry keeps
// its shape so per-user entitlement (User.appAccess) still works.
export type AppKey = "initiatives";

export type AppDef = {
  key: AppKey;
  name: string;
};

export const APPS: AppDef[] = [{ key: "initiatives", name: "Strategic Initiatives" }];

export function hasApp(role: string | null | undefined, appAccess: string[] | null | undefined, key: AppKey): boolean {
  if (role === "admin") return true;
  return (appAccess ?? []).includes(key);
}
