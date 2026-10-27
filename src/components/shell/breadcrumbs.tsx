"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Header breadcrumbs, derived from the URL and rooted at the app name. Static segments map to the names
// used in the sidebar and settings tabs; a dynamic segment (an initiative id,
// a risk id) shows whatever the page registers with <BreadcrumbTitle>, or a
// generic label until it does.

const LABELS: Record<string, string> = {
  initiatives: "Initiatives",
  groups: "Groups",
  reporting: "Reporting",
  quadrant: "Lift × Value",
  risks: "CIM Risks",
  scorecard: "Owner Scorecard",
  settings: "Settings",
  password: "Change password",
  people: "People & access",
  roster: "Directory",
  lists: "Manage lists",
  admin: "Admin",
  "data-sources": "Data sources",
  "ai-telemetry": "AI telemetry",
  plans: "Plan versions",
  archive: "Archive",
  asks: "Asks by leader",
  "below-the-line": "Below the line",
  definitions: "Definitions",
  inbox: "Inbox",
  my: "My SIs",
  review: "Review",
  timeline: "Timeline",
  new: "New",
  edit: "Edit",
};

// Paths that only group child routes and have no page of their own.
const NO_PAGE = [/^\/admin\/people\/roster$/, /^\/admin\/initiatives\/[^/]+$/, /^\/review$/, /^\/risks\/[^/]+$/];

const TitleContext = createContext<{ titles: Record<string, string>; setTitle: (path: string, title: string | null) => void }>({
  titles: {},
  setTitle: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const setTitle = useCallback(
    (path: string, title: string | null) =>
      setTitles((t) => {
        if (title === null) {
          const rest = { ...t };
          delete rest[path];
          return rest;
        }
        return t[path] === title ? t : { ...t, [path]: title };
      }),
    [],
  );
  return <TitleContext.Provider value={{ titles, setTitle }}>{children}</TitleContext.Provider>;
}

/** Names the crumb for `path` (e.g. "/initiatives/abc123") from inside a page. Renders nothing. */
export function BreadcrumbTitle({ path, title }: { path: string; title: string }) {
  const { setTitle } = useContext(TitleContext);
  useEffect(() => {
    setTitle(path, title);
    return () => setTitle(path, null);
  }, [path, title, setTitle]);
  return null;
}

function labelFor(segment: string): string {
  return LABELS[segment] ?? decodeURIComponent(segment);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { titles } = useContext(TitleContext);
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { href, label: titles[href] ?? labelFor(seg), linkable: !NO_PAGE.some((re) => re.test(href)) };
  });

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        <BreadcrumbItem>
          {crumbs.length === 0 ? (
            <span>Strategic Initiatives</span>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/">Strategic Initiatives</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {/* "/" is the Strategy Review page itself. */}
        {crumbs.length === 0 && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Strategy Review</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden sm:inline-flex" : undefined}>
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage title={c.label} className="max-w-[40ch]">{c.label}</BreadcrumbPage>
              ) : c.linkable ? (
                <BreadcrumbLink asChild>
                  <Link href={c.href} className="max-w-[24ch] truncate">{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span className="max-w-[24ch] truncate">{c.label}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
