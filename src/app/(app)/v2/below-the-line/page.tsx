import { requireApp } from "@/lib/session";
import { BelowTheLineView, type BtlGroup } from "../_components/below-the-line-view";
import { V2Header } from "../_components/preview";
import { BTL_PROJECTS } from "../_mock/below-the-line";
import { AREAS } from "../_mock/data";
import { fmtDay, names, siByCode, siShortCode } from "../_mock/selectors";

export default async function BelowTheLinePage() {
  await requireApp("initiatives");
  const groups: BtlGroup[] = AREAS.map((a) => ({
    areaCode: a.code,
    areaName: a.name,
    kindLabel: a.number ? `Pillar ${a.number}` : "Enabler",
    leads: `ELT: ${names(a.eltOwnerIds)} · SI lead${a.siLeadIds.length > 1 ? "s" : ""}: ${names(a.siLeadIds)}`,
    rows: BTL_PROJECTS.filter((p) => p.areaCode === a.code).map((p) => {
      const si = p.siCode ? siByCode(p.siCode) : undefined;
      return {
        id: p.id,
        name: p.name,
        feeds: p.feeds,
        team: p.team,
        owner: p.owner,
        status: p.status,
        dueLabel: fmtDay(p.due),
        si: si ? { code: si.code, shortCode: siShortCode(si.code), name: si.name } : null,
      };
    }),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <V2Header
        eyebrow="Below the line"
        title="Below the line"
        description="The smaller projects junior teams run in each function that feed the strategic initiatives above the line. Each one links to the SI it feeds, with an owner and a status. The MVP lists this view as coming; the projects here are invented."
      />
      <BelowTheLineView groups={groups} />
    </div>
  );
}
