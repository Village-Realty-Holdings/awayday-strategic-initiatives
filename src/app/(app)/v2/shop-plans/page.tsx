import { requireApp } from "@/lib/session";
import { V2Header } from "../_components/preview";

export default async function ShopPlansPage() {
  await requireApp("initiatives");

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <V2Header
        eyebrow="Future architecture"
        title="Shop-level strategy plans"
        description="This section is intentionally blank for now. It reserves the navigation and information architecture for shop-level plans that will be added later in FY27."
      />
      <section className="rounded-xl border border-dashed border-border-strong bg-surface p-8 text-center">
        <p className="text-sm font-medium text-ink">No shop-level strategy plans yet</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-muted">
          When this workflow is introduced, each shop plan can be connected to the strategy-house pillars and the
          initiatives that support them. Nothing is loaded or editable on this page today.
        </p>
      </section>
    </div>
  );
}
