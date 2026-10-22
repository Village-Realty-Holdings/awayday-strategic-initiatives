"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };
}

export function SignOutButton() {
  const signOut = useSignOut();
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
