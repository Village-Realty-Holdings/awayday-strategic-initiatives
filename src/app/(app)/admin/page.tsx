import Link from "next/link";
import { LineChart, Users, ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin — Awayday" };

export default async function AdminPage() {
  await requireSession({ role: "admin" });

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Admin · Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          System-level settings. People and logins are managed on the People page.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SettingCard
          href="/admin/scoreboard"
          icon={<LineChart size={18} className="text-navy" aria-hidden />}
          title="Overview scoreboard"
          sub="Advanced EBITDA edits: the LTM trend and the build bridge. Headline figures and the scorecard are edited inline on the Overview."
        />
        <SettingCard
          href="/people"
          icon={<Users size={18} className="text-navy" aria-hidden />}
          title="People & access"
          sub="Add people, grant logins, set roles, reset passwords and MFA."
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
