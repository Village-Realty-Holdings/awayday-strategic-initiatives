import { Info } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { READ_FIRST } from "../_mock/review-detail";

export function ReadFirstBanner() {
  return (
    <Card className="border-gold/60 bg-gold/10" aria-labelledby="read-first-title">
      <CardHeader>
        <CardTitle id="read-first-title" className="flex flex-wrap items-center gap-2 text-sm">
          <Info size={16} className="text-gold-deep" aria-hidden />
          {READ_FIRST.title}
          <Badge variant="outline">Status: TBD</Badge>
          <Badge variant="outline">Coming soon: inbox and below the line</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-x-6 gap-y-2.5 text-xs md:grid-cols-2">
          {READ_FIRST.points.map((p) => (
            <div key={p.label}>
              <dt className="font-semibold text-ink">{p.label}</dt>
              <dd className="mt-0.5 leading-5 text-ink-muted">{p.body}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-gold/40 pt-3 text-xs leading-5 text-ink-muted">{READ_FIRST.credit}</p>
      </CardContent>
    </Card>
  );
}
