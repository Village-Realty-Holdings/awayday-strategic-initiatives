// Role checks with no request context, so they work for a cookie session and an
// API token alike. session.ts re-exports canEdit for existing callers.

/** Write access: admins and editors can modify; viewers are read-only. */
export function canEdit(role?: string | null): boolean {
  return role === "admin" || role === "editor";
}
