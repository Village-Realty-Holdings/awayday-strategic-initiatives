import { requireSession } from "@/lib/session";
import { SettingsTabs } from "@/components/settings-tabs";

// Settings section: password, people & access, and (admins only) system
// settings. Each page still enforces its own role checks.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">Settings</p>
        <SettingsTabs isAdmin={user.role === "admin"} />
      </div>
      {children}
    </div>
  );
}
