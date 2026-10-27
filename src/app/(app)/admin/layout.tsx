import { requireSession } from "@/lib/session";
import { AdminTabs } from "@/components/admin-tabs";
import { Eyebrow } from "@/components/shell/page-header";

// Admin section: people, groups, data sources, initiatives, plan versions,
// strategy reference and AI telemetry. Pages enforce their own admin/editor
// permissions: the initiative edit page is shared with editors, while the
// rest of the admin surface remains admin-only.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="mx-auto flex max-w-section flex-col gap-6">
      {session.user.role === "admin" && (
        <div className="flex flex-col gap-3">
          <Eyebrow>Admin</Eyebrow>
          <AdminTabs />
        </div>
      )}
      {children}
    </div>
  );
}
