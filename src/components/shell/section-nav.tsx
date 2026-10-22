"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// In-page sections a page exposes to the sidebar (e.g. the Strategy Review's
// Summary / Financials / pillars), plus scroll-spy for the active one. The
// page registers with <RegisterSections>; the sidebar renders them under its
// nav item. Scrolling happens in the inset content card (.app-inset).

export type PageSection = { id: string; label: string };

const SectionContext = createContext<{
  sections: PageSection[];
  setSections: (s: PageSection[]) => void;
}>({ sections: [], setSections: () => {} });

export function SectionNavProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSectionsState] = useState<PageSection[]>([]);
  const setSections = useCallback((s: PageSection[]) => setSectionsState(s), []);
  return <SectionContext.Provider value={{ sections, setSections }}>{children}</SectionContext.Provider>;
}

/** Publishes this page's sections to the sidebar while it is mounted. Renders nothing. */
export function RegisterSections({ sections }: { sections: PageSection[] }) {
  const { setSections } = useContext(SectionContext);
  const key = JSON.stringify(sections);
  useEffect(() => {
    setSections(JSON.parse(key));
    return () => setSections([]);
  }, [key, setSections]);
  return null;
}

export function usePageSections() {
  return useContext(SectionContext).sections;
}

/**
 * Id of the section currently at the top of the content card: the last one
 * whose top has scrolled to within `offset` px of the card's top edge.
 */
export function useActiveSection(sections: PageSection[], offset = 96): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(".app-inset");
    if (!panel || sections.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = panel.getBoundingClientRect().top + offset;
      let current: string | null = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= top) current = s.id;
      }
      // At the very bottom the last short sections can never reach the top.
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2) current = sections[sections.length - 1].id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    panel.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      panel.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections, offset]);
  return active;
}
