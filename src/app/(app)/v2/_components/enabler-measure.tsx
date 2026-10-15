import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ENABLER_MEASURES } from "../_mock/review-detail";
import { MILESTONES } from "../_mock/data";
import { fmtDay, isPastDue, names, sortedMilestones } from "../_mock/selectors";
import { Stat, SubHeading } from "./stat";

/** Measure card for one enabler, plus its milestones (so Talent shows something without any SIs). */
export function EnablerMeasureCard({ areaCode }: { areaCode: string }) {
  const m = ENABLER_MEASURES.find((x) => x.areaCode === areaCode);
  const milestones = sortedMilestones(MILESTONES.filter((x) => x.pillar === areaCode && !x.done));
  if (!m && milestones.length === 0) return null;
  return (
    <Card className="mt-3 bg-surface-2/30">
      {m && (
        <>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {m.measureName}
              <Badge variant={m.state === "Not yet set" ? "outline" : "secondary"}>{m.state}</Badge>
            </CardTitle>
            <CardDescription>Enabler leading measure</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(m.current || m.target) && (
              <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                <Stat label="Today" value={m.current ?? "n/a"} />
                <Stat label={`Target${m.targetLabel ? ` (${m.targetLabel})` : ""}`} value={m.target ?? "n/a"} />
              </div>
            )}
            {m.notes.map((n) => (
              <p key={n} className="text-xs leading-5 text-ink-muted">
                {n}
              </p>
            ))}
            {m.candidates && (
              <div>
                <SubHeading>Candidate measures</SubHeading>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {m.candidates.map((c) => (
                    <li key={c}>
                      <Badge variant="outline">{c}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {m.bullets && (
              <div>
                <SubHeading>{m.bullets.title}</SubHeading>
                <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-muted">
                  {m.bullets.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </>
      )}
      {milestones.length > 0 && (
        <CardContent className={m ? "border-t border-border/70 pt-4" : ""}>
          <SubHeading>Milestones</SubHeading>
          <ul className="mt-1.5 flex flex-col gap-1.5 text-xs">
            {milestones.map((x) => (
              <li key={x.id} className="grid grid-cols-[4.5rem_1fr] gap-2">
                <span className={`tabular ${isPastDue(x) ? "font-semibold text-warn" : "text-ink-faint"}`}>{x.approxLabel ?? fmtDay(x.date)}</span>
                <span className="text-ink-muted">
                  {x.title} <span className="text-ink-faint">· {names(x.ownerIds)}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
