"use client";

import { useState } from "react";
import { oauthAuthClient } from "@/lib/oauth-client";
import { Button } from "@/components/ui/button";
import { MicrosoftGlyph } from "@/components/microsoft-glyph";

export function MicrosoftSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    setLoading(true);
    // oauthAuthClient sends this page's signed OAuth query along, so after
    // Microsoft the provider resumes the authorization instead of opening the app.
    const { error } = await oauthAuthClient.signIn.social({ provider: "microsoft" });
    if (error) {
      setLoading(false);
      setError(error.message ?? "Microsoft sign-in failed.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={signIn} disabled={loading} className="flex w-full gap-2 bg-bg px-3">
        <MicrosoftGlyph />
        {loading ? "Redirecting…" : "Sign in with Microsoft"}
      </Button>
      {error && <p className="text-xs text-risk">{error}</p>}
    </div>
  );
}
