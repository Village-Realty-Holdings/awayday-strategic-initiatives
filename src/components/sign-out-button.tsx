"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      title="Sign out"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="text-ink-faint transition-colors hover:text-ink"
    >
      <LogOut size={15} aria-hidden />
    </button>
  );
}
