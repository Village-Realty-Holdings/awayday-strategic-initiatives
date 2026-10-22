"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// The inset content panel (.app-inset) is the page's scroll container, not
// the window. Next's own scroll-on-navigate brings the new segment into view,
// which leaves it tucked under the sticky header, so on every path change we
// return the panel to the top (unless the URL targets an #anchor).
export function InsetScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.location.hash) return;
    const panel = document.querySelector<HTMLElement>(".app-inset");
    if (!panel) return;
    panel.scrollTop = 0;
    // Next may scroll after this effect; settle once more on the next frame.
    const raf = requestAnimationFrame(() => {
      panel.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
  return null;
}
