import { requireApp } from "@/lib/session";
import { AsksByLeader } from "../_components/asks-by-leader";
import { V2Header } from "../_components/preview";
import { LATEST_PERIOD } from "../_mock/selectors";

export default async function AsksPage() {
  await requireApp("initiatives");
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <V2Header
        eyebrow="Asks by leader"
        title={`Asks by leader · ${LATEST_PERIOD.label}`}
        description="The same two asks for every SI: latest progress, what next. Each leader's SIs show this month's update state and anything still open."
      />
      <AsksByLeader periodId={LATEST_PERIOD.id} />
    </div>
  );
}
