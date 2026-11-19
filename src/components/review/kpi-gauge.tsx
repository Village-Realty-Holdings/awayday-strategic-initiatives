import {
  formatGaugeValue,
  gaugeAriaLabel,
  gaugeDomain,
  gaugeOverflow,
  gaugePercent,
  layoutGaugeLabels,
  type GaugeLane,
  type GaugeSpec,
} from "@/lib/kpi-gauge";
import { statusToneWithRule, type KpiStatus, type StatusTone } from "@/lib/kpi-status";

// The gauge: actual against its targets, in the metric's own unit.
//
// Improvements over the reference implementation this replaces:
//  - labels are placed in four lanes, so clustered targets (2026 goal, FY27
//    budget, FY27 stretch) stop overlapping near the right-hand end;
//  - labels at either end align inward instead of being clipped;
//  - a missing actual still renders the track and the targets, and says so;
//  - negative domains and lower-is-better metrics work unchanged;
//  - the whole thing is one `role="img"` with a sentence that names every value,
//    so it never depends on colour or on seeing the marks;
//  - every colour comes from a theme token.

const LANE_TOP: Record<GaugeLane, number> = { "above-2": 0, "above-1": 15, "below-1": 44, "below-2": 59 };

const ALIGN_TRANSFORM = { left: "translateX(0)", center: "translateX(-50%)", right: "translateX(-100%)" } as const;

export function KpiGauge({
  spec,
  status,
  toneRule,
  caption,
  className,
}: {
  spec: GaugeSpec;
  /** The status to colour the actual marker with; omitted, the marker stays neutral. */
  status?: KpiStatus;
  /** Approved business meaning for under_budget / floor_breached. */
  toneRule?: StatusTone;
  /** A short caption shown to assistive technology after the gauge's own summary. */
  caption?: string;
  className?: string;
}) {
  const domain = gaugeDomain(spec);
  const labels = layoutGaugeLabels(spec.targets, domain);
  const actualPercent = spec.actual == null ? null : gaugePercent(spec.actual, domain.min, domain.max);
  const overflow = spec.actual == null ? null : gaugeOverflow(spec.actual, domain.min, domain.max);
  const tone: StatusTone = status ? statusToneWithRule(status, toneRule) : "neutral";
  const minLabel = formatGaugeValue(domain.min, spec.format, spec.decimals);
  const maxLabel = formatGaugeValue(domain.max, spec.format, spec.decimals);

  return (
    <div className={`kpi-gauge kpi-gauge--${tone} ${className ?? ""}`} role="img" aria-label={gaugeAriaLabel(spec)}>
      <div className="kpi-gauge__plot">
        {actualPercent != null && <div className="kpi-gauge__fill" style={{ width: `${actualPercent}%` }} />}
        {spec.targets.map((target) => (
          <div
            key={target.id}
            className={`kpi-gauge__marker ${target.style === "reference" ? "kpi-gauge__marker--reference" : ""}`}
            style={{ left: `${gaugePercent(target.value, domain.min, domain.max)}%` }}
            data-gauge-marker={target.id}
          />
        ))}
        {actualPercent != null && (
          <div className="kpi-gauge__actual" style={{ left: `${actualPercent}%` }} data-gauge-actual={status ?? "no_status"} />
        )}
        {overflow === "above" && (
          <span className="kpi-gauge__overflow" style={{ right: 0 }} aria-hidden>
            ▶
          </span>
        )}
        {overflow === "below" && (
          <span className="kpi-gauge__overflow" style={{ left: 0 }} aria-hidden>
            ◀
          </span>
        )}
      </div>

      <div className="kpi-gauge__labels">
        {labels.map((placement, index) => {
        const target = spec.targets[index];
          return (
            <span
              key={placement.id}
              className="kpi-gauge__label"
              style={{
                left: `${placement.percent}%`,
                top: `${LANE_TOP[placement.lane]}px`,
                transform: ALIGN_TRANSFORM[placement.align],
              }}
              data-gauge-label={placement.id}
              data-lane={placement.lane}
            >
              {target.label} <b>{formatGaugeValue(target.value, spec.format, spec.decimals)}</b>
            </span>
          );
        })}
      </div>

      {spec.actual == null && <p className="kpi-gauge__empty">No value loaded for this period</p>}

      <div className="kpi-gauge__ends" aria-hidden>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>

      {/* The same values, readable when the marker labels have no room (phones). */}
      <dl className="kpi-gauge__legend">
        {spec.actual != null && (
          <div>
            <dt>Actual</dt>
            <dd>{formatGaugeValue(spec.actual, spec.format, spec.decimals)}</dd>
          </div>
        )}
        {spec.targets.map((target) => (
          <div key={`legend-${target.id}`}>
            <dt>{target.label}</dt>
            <dd>{formatGaugeValue(target.value, spec.format, spec.decimals)}</dd>
          </div>
        ))}
      </dl>

      {caption && <p className="sr-only">{caption}</p>}
    </div>
  );
}
