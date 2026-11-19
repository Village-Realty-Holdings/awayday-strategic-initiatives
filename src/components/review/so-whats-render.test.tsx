import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SoWhatList, toneForStatus, toneForStatuses } from "./so-whats";

// So-what presentation: a bold lead statement, the supporting body, a tone that
// never relies on colour alone, and plain text only (no HTML from the database).

describe("SoWhatList", () => {
  const items = [
    { id: "1", headline: "Volume stayed ahead", body: "Adds beat budget for the month." },
    { id: "2", headline: "Cost per add kept rising", body: "Spend ran over plan." },
    { id: "3", headline: "Watching cycle time", body: null },
  ];

  it("renders every item in order, with a bold headline and its body", () => {
    const html = renderToStaticMarkup(<SoWhatList items={items} />);
    expect(html.indexOf("Volume stayed ahead")).toBeLessThan(html.indexOf("Cost per add kept rising"));
    expect(html.indexOf("Cost per add kept rising")).toBeLessThan(html.indexOf("Watching cycle time"));
    expect(html).toContain("<strong class=\"font-semibold\">Volume stayed ahead</strong>");
    expect(html).toContain("Adds beat budget for the month.");
    expect(html).toContain("whitespace-pre-line");
  });

  it("defaults to a neutral tone and names it for screen readers", () => {
    const html = renderToStaticMarkup(<SoWhatList items={items} />);
    expect(html.match(/data-so-what-tone="neutral"/g)).toHaveLength(3);
    expect(html).toContain("Note:");
    expect(html).toContain("sr-only");
  });

  it("uses an item's own tone ahead of the section default", () => {
    const html = renderToStaticMarkup(
      <SoWhatList tone="positive" items={[{ id: "1", headline: "Good", body: null, tone: "negative" }]} />,
    );
    expect(html).toContain('data-so-what-tone="negative"');
    expect(html).toContain("Negative:");
  });

  it("supports all four tones", () => {
    for (const tone of ["positive", "negative", "warning", "neutral"] as const) {
      const html = renderToStaticMarkup(
        <SoWhatList tone={tone} items={[{ id: tone, headline: `Item ${tone}`, body: null }]} />,
      );
      expect(html).toContain(`data-so-what-tone="${tone}"`);
    }
  });

  it("keeps the body as text, never as markup", () => {
    const html = renderToStaticMarkup(
      <SoWhatList items={[{ id: "x", headline: "Headline", body: "<script>alert(1)</script> and <b>bold</b>" }]} />,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("renders nothing for an empty list", () => {
    expect(renderToStaticMarkup(<SoWhatList items={[]} />)).toBe("<ul class=\"flex flex-col gap-3 \"></ul>");
  });
});

describe("so-what tone from a status", () => {
  it("maps each status to the matching tone", () => {
    expect(toneForStatus("ahead")).toBe("positive");
    expect(toneForStatus("behind")).toBe("negative");
    expect(toneForStatus("floor_breached")).toBe("negative");
    expect(toneForStatus("under_budget")).toBe("warning");
    expect(toneForStatus("needs_attention")).toBe("warning");
    expect(toneForStatus("no_data")).toBe("neutral");
    expect(toneForStatus(null)).toBe("neutral");
  });

  it("only applies a shared tone when the sections agree", () => {
    expect(toneForStatuses(["ahead", "on_track"])).toBe("positive");
    expect(toneForStatuses(["behind", "behind"])).toBe("negative");
    expect(toneForStatuses(["ahead", "behind"])).toBe("neutral");
    expect(toneForStatuses([])).toBe("neutral");
  });
});
