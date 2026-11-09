"use client";

import { KeyRound, Lock } from "@/components/icons";
import { LinkTabs, type LinkTab } from "@/components/shell/link-tabs";

const TABS: LinkTab[] = [
  { label: "Change password", href: "/settings/password", icon: Lock },
  { label: "Connected apps", href: "/settings/connected-apps", icon: KeyRound },
];

export function SettingsTabs() {
  return <LinkTabs items={TABS} label="Settings sections" />;
}
