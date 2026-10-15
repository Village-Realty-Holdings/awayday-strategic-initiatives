import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFINITIONS, type Definition } from "../_mock/definitions";
import { SubHeading } from "./stat";

function DefinitionCard({ d }: { d: Definition }) {
  return (
    <Card id={d.id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {d.title}
          <Badge variant="secondary">{d.kind}</Badge>
          {d.followUp && <Badge variant="warn">Open follow-up</Badge>}
        </CardTitle>
        <CardDescription className="text-sm leading-5">{d.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {d.variants && (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {d.variants.map((v) => (
              <li
                key={v.label}
                className={`rounded-lg border px-3 py-2.5 ${v.used ? "border-navy/40 bg-navy/5" : "border-border bg-surface-2/40"}`}
              >
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                  {v.label}
                  {v.used && <Badge variant="default">Used on the review</Badge>}
                </p>
                <p className="tabular mt-0.5 text-lg font-semibold text-ink">{v.value}</p>
                {v.note && <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">{v.note}</p>}
              </li>
            ))}
          </ul>
        )}
        {d.bullets && (
          <ul className="list-disc space-y-1.5 pl-4 text-xs leading-5 text-ink-muted">
            {d.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        <dl className="grid gap-3 text-xs md:grid-cols-3">
          <div>
            <dt className="font-semibold text-ink">What the review does</dt>
            <dd className="mt-0.5 leading-5 text-ink-muted">{d.decision}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">To close before November</dt>
            <dd className="mt-0.5 leading-5 text-ink-muted">{d.followUp ?? "Nothing open."}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Source</dt>
            <dd className="mt-0.5 leading-5 text-ink-muted">{d.source}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function DefinitionsView() {
  const open = DEFINITIONS.filter((d) => d.followUp).length;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Definitions" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-xs">
        {DEFINITIONS.map((d) => (
          <a key={d.id} href={`#${d.id}`} className="whitespace-nowrap rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
            {d.title}
          </a>
        ))}
      </nav>
      <p className="text-xs text-ink-muted">
        <SubHeading>{DEFINITIONS.length} entries</SubHeading>
        <span className="mt-1 block">
          {open} have an open follow-up. Back to the{" "}
          <Link href="/v2/review" className="text-navy hover:underline">
            Strategy Review
          </Link>
          .
        </span>
      </p>
      {DEFINITIONS.map((d) => (
        <DefinitionCard key={d.id} d={d} />
      ))}
    </div>
  );
}
