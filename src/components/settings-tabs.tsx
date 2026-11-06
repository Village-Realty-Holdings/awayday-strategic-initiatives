"use client";

import { KeyRound, Lock } from "@/components/icons";
import { LinkTabs, type LinkTab } from "@/components/shell/link-tabs";

const TABS: LinkTab[] = [
  { label: "Change password", href: "/settings/password", icon: Lock },
  { label: "API tokens", href: "/settings/api-tokens", icon: KeyRound },
];

export function SettingsTabs() {
  return <LinkTabs items={TABS} label="Settings sections" />;
}
