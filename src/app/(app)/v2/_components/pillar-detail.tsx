import { ChurnLists, ShopsUnderBudget, TrevparDetail, UnitAddsLists } from "./brand-lists";
import { GuestTracking } from "./guest-tracking";
import { MaDetail } from "./ma-detail";

/** Extra section content per pillar (September detail from the MVP). */
export function PillarDetail({ areaCode }: { areaCode: string }) {
  switch (areaCode) {
    case "M&A":
      return <MaDetail />;
    case "GROW":
      return <UnitAddsLists />;
    case "RETENTION":
      return <ChurnLists />;
    case "TREVPAR":
      return <TrevparDetail />;
    case "MARGIN":
      return <ShopsUnderBudget />;
    case "GUEST":
      return <GuestTracking />;
    default:
      return null;
  }
}
