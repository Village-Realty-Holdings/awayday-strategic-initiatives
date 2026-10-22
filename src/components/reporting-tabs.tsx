"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ReportingView = "narrative" | "gantt";

// Both panes stay mounted (forceMount) so a drafted narrative survives a trip
// to the Gantt tab. The active tab is mirrored to ?view= for bookmarking.
export function ReportingTabs({
  initialView,
  narrative,
  gantt,
}: {
  initialView: ReportingView;
  narrative: React.ReactNode;
  gantt: React.ReactNode;
}) {
  const router = useRouter();
  const [view, setView] = useState<ReportingView>(initialView);
  return (
    <Tabs
      value={view}
      onValueChange={(v) => {
        const next = v as ReportingView;
        setView(next);
        router.replace(next === "gantt" ? "/reporting?view=gantt" : "/reporting", { scroll: false });
      }}
      className="gap-5"
    >
      <TabsList className="no-print">
        <TabsTrigger value="narrative">Board Narrative</TabsTrigger>
        <TabsTrigger value="gantt">Gantt</TabsTrigger>
      </TabsList>
      <TabsContent value="narrative" forceMount className="data-[state=inactive]:hidden">
        {narrative}
      </TabsContent>
      <TabsContent value="gantt" forceMount className="data-[state=inactive]:hidden">
        {gantt}
      </TabsContent>
    </Tabs>
  );
}
