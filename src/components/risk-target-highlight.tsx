"use client";

import { useEffect } from "react";

// Flash the risk row matching the URL hash when you click a chip/dot in the
// scorecard or heat-map. The links are plain <a> hash links, so they fire
// `hashchange`; this scrolls the row into view and animates a gold highlight so
// it's obvious which risk you landed on. Renders nothing.
export function RiskTargetHighlight() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("risk-flash");
      void el.offsetWidth; // reflow so re-clicking the same row restarts the animation
      el.classList.add("risk-flash");
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove("risk-flash"), 5000);
    };
    flash(); // handle a hash present on initial load
    window.addEventListener("hashchange", flash);
    return () => {
      window.removeEventListener("hashchange", flash);
      clearTimeout(timer);
    };
  }, []);
  return null;
}
