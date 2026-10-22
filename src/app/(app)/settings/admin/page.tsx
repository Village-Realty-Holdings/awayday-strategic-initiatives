import Link from "next/link";
import { LineChart, ChevronRight, ClipboardCheck, PanelsTopLeft } from "@/components/icons";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin settings — Awayday" };

export default async function AdminPage() {
  await requireSession({ role: "admin" });

  return (
    <div className="max-w-[1000px]">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Admin settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          System-level settings. People and logins are managed under People &amp; access.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SettingCard
          href="/settings/admin/plans"
          icon={<PanelsTopLeft size={18} className="text-navy" aria-hidden />}
          title="Plan versions"
          sub="Switch the active dashboard between imported planning periods such as FY26 and FY27."
        />
        <SettingCard
          href="/settings/admin/scoreboard"
          icon={<LineChart size={18} className="text-navy" aria-hidden />}
          title="Overview scoreboard"
          sub="Advanced EBITDA edits: the LTM trend and the build bridge. Headline figures and the scorecard are edited inline on the Overview."
        />
        <SettingCard
          href="/settings/admin/completeness"
          icon={<ClipboardCheck size={18} className="text-navy" aria-hidden />}
          title="FY27 completeness report"
          sub="Review TBD owners, missing KPI definitions, incomplete charters, and integration gaps."
        />
      </div>
    </div>
  );
}

function SettingCard({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2/50"
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>
          <span className="block text-sm font-medium text-ink">{title}</span>
          <span className="block text-xs text-ink-muted">{sub}</span>
        </span>
      </span>
      <ChevronRight size={16} className="text-ink-faint" aria-hidden />
    </Link>
  );
}
