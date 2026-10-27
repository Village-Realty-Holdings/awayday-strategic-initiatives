import { requireAdmin } from "@/lib/session";
import { AdminTabs } from "@/components/admin-tabs";
import { Eyebrow } from "@/components/shell/page-header";

// Admin section: people, groups, data sources, initiatives, plan
// versions and AI telemetry. Admins only; every page and action under here
// still calls requireAdmin() itself.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto flex max-w-section flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Eyebrow>Admin</Eyebrow>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
