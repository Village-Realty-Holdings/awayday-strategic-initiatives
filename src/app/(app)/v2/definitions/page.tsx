import { requireApp } from "@/lib/session";
import { DefinitionsView } from "../_components/definitions-view";
import { V2Header } from "../_components/preview";

export default async function DefinitionsPage() {
  await requireApp("initiatives");
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <V2Header
        eyebrow="Metric definitions"
        title="Metric definitions and data notes"
        description="Where two numbers describe the same thing on different bases, which one the review uses, and the gaps to close before the November review. Content is the September 2026 list from the MVP."
      />
      <DefinitionsView />
    </div>
  );
}
