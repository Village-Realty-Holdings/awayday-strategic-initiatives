"use client";

import { useState } from "react";
import { oauthAuthClient } from "@/lib/oauth-client";
import { Button } from "@/components/ui/button";
import { MCP_WRITE_SCOPE } from "@/lib/mcp-oauth";

type Choice = "write" | "read" | "deny";

export function ConsentButtons({ scopes, wantsWrite }: { scopes: string[]; wantsWrite: boolean }) {
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState("");

  async function decide(choice: Choice) {
    setError("");
    setBusy(choice);
    const { data, error } =
      choice === "deny"
        ? await oauthAuthClient.oauth2.consent({ accept: false })
        : await oauthAuthClient.oauth2.consent({
            accept: true,
            // Read only drops mcp:write from what was requested; editing keeps everything.
            scope: choice === "read" ? scopes.filter((s) => s !== MCP_WRITE_SCOPE).join(" ") : undefined,
          });
    if (error) {
      setBusy(null);
      setError(error.message ?? "Couldn't record your answer. Go back to Claude and try again.");
      return;
    }
    // The provider answers with Claude's callback URL (with the code, or access_denied).
    const url = (data as { url?: string } | null)?.url;
    if (url) window.location.assign(url);
  }

  return (
    <div className="flex flex-col gap-2">
      {wantsWrite && (
        <Button type="button" onClick={() => decide("write")} disabled={busy !== null}>
          {busy === "write" ? "…" : "Allow editing"}
        </Button>
      )}
      <Button type="button" variant={wantsWrite ? "secondary" : "default"} onClick={() => decide("read")} disabled={busy !== null}>
        {busy === "read" ? "…" : wantsWrite ? "Allow read only" : "Allow"}
      </Button>
      <Button type="button" variant="link" size="sm" onClick={() => decide("deny")} disabled={busy !== null} className="self-center font-normal text-ink-muted">
        Cancel
      </Button>
      {error && <p className="text-xs text-risk">{error}</p>}
    </div>
  );
}
