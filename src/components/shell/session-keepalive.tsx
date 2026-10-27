"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

// Page renders can't set cookies, so the daily session refresh only reaches the
// browser through a route handler. This asks /api/auth/get-session when the tab
// opens or comes back into view, which renews the cookie for people who mostly
// read. A tab whose session has ended (expired, revoked, password changed
// elsewhere) is sent to sign-in with a full page load instead of half-working.
const MIN_INTERVAL_MS = 5 * 60 * 1000;

export function SessionKeepalive() {
  useEffect(() => {
    let last = 0;
    let inFlight = false;

    async function check() {
      if (inFlight || Date.now() - last < MIN_INTERVAL_MS) return;
      inFlight = true;
      last = Date.now();
      try {
        const { data, error } = await authClient.getSession();
        // An error (offline, 429) says nothing about the session; only a clean
        // "no session" answer sends the person to sign in.
        if (!error && !data) {
          const here = window.location.pathname + window.location.search;
          // A full load on purpose: it drops the stale client router state.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/login?redirect=${encodeURIComponent(here)}`);
        }
      } catch {
        // Network failure: try again on the next focus.
      } finally {
        inFlight = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
