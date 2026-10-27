"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };
}

// Icon-only by default (header use); pass `label` for a full button.
export function SignOutButton({ label }: { label?: string } = {}) {
  const signOut = useSignOut();
  if (label) {
    return (
      <Button type="button" className="gap-1.5" onClick={signOut}>
        <LogOut size={15} aria-hidden /> {label}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="faint"
      size="bare"
      title="Sign out"
      aria-label="Sign out"
      onClick={signOut}
    >
      <LogOut size={15} aria-hidden />
    </Button>
  );
}
