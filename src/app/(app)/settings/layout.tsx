import { requireSession } from "@/lib/session";
import { Eyebrow } from "@/components/shell/page-header";

// Settings section: the signed-in user's own account (today, just the
// password). People, groups, plans and other system settings live in the
// admin-only Admin section (/admin).
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="mx-auto flex max-w-section flex-col gap-6">
      <Eyebrow>Settings</Eyebrow>
      {children}
    </div>
  );
}
