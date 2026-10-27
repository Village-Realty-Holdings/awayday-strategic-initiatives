import { requireAdmin } from "@/lib/session";
import { AdminTabs } from "@/components/admin-tabs";

// Admin section: people, groups, data sources, initiatives, archive, plan
// versions and AI telemetry. Admins only; every page and action under here
// still calls requireAdmin() itself.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">Admin</p>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
