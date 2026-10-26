import { SiCharterDialog } from "./si-charter-dialog";
import type { MockSi } from "../_mock/types";

export function SiCard({ si, periodId, recordId }: { si: MockSi; periodId: string; recordId?: string }) {
  return <SiCharterDialog si={si} periodId={periodId} recordId={recordId} />;
}
