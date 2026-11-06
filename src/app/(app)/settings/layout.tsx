import { requireSession } from "@/lib/session";
import { Eyebrow } from "@/components/shell/page-header";
import { SettingsTabs } from "@/components/settings-tabs";

// Settings section: the signed-in user's own account (password and API
// tokens). People, groups, plans and other system settings live in the
// admin-only Admin section (/admin).
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="mx-auto flex max-w-section flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Eyebrow>Settings</Eyebrow>
        <SettingsTabs />
      </div>
      {children}
    </div>
  );
}
