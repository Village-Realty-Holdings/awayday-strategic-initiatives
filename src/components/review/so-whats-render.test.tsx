import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SoWhatList, soWhatItems, soWhatToneFromStored, toneForRag, toneForStatus, toneForStatuses } from "./so-whats";

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

describe("stored so-what tones", () => {
  it("maps each stored value to its presentation tone", () => {
    expect(soWhatToneFromStored("POSITIVE")).toBe("positive");
    expect(soWhatToneFromStored("NEGATIVE")).toBe("negative");
    expect(soWhatToneFromStored("WARNING")).toBe("warning");
    expect(soWhatToneFromStored("NEUTRAL")).toBe("neutral");
    // A row written before tones existed carries none, and neither does an
    // unknown value: both inherit the section rather than inventing a colour.
    expect(soWhatToneFromStored(null)).toBeUndefined();
    expect(soWhatToneFromStored(undefined)).toBeUndefined();
    expect(soWhatToneFromStored("text-risk" as never)).toBeUndefined();
  });

  it("renders a mixed section: each item keeps its own tone over the section's", () => {
    const items = soWhatItems([
      { id: "1", headline: "Volume ahead", body: null, tone: "POSITIVE" },
      { id: "2", headline: "CAC off track", body: null, tone: "NEGATIVE" },
      { id: "3", headline: "Watch cycle time", body: null, tone: "WARNING" },
      { id: "4", headline: "No tone stored", body: null, tone: null },
    ]);
    const html = renderToStaticMarkup(<SoWhatList items={items} tone="negative" />);
    expect(html.match(/data-so-what-tone="positive"/g)).toHaveLength(1);
    expect(html.match(/data-so-what-tone="negative"/g)).toHaveLength(2);
    expect(html.match(/data-so-what-tone="warning"/g)).toHaveLength(1);
    // The item with no tone inherits the section's tone, never a guessed one.
    expect(html).toContain("Positive:");
    expect(html).toContain("Watch:");
    expect(html).toContain("Negative:");
  });

  it("keeps the headline and wording exactly as stored", () => {
    const html = renderToStaticMarkup(
      <SoWhatList items={soWhatItems([{ id: "x", headline: "Shops beat, centre spent it", body: "Shop NOI $1.0M over budget.\nSecond line.", tone: "POSITIVE" }])} />,
    );
    expect(html).toContain("Shops beat, centre spent it");
    expect(html).toContain("Shop NOI $1.0M over budget.");
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

describe("toneForRag — a section's commentary carries its pillar's colour", () => {
  it("maps the review's pillar RAG to the same three colours", () => {
    expect(toneForRag("GREEN")).toBe("positive");
    expect(toneForRag("AMBER")).toBe("warning");
    expect(toneForRag("RED")).toBe("negative");
    expect(toneForRag("GREY")).toBe("neutral");
    expect(toneForRag(null)).toBe("neutral");
    expect(toneForRag(undefined)).toBe("neutral");
  });

  it("colours an on-track pillar's so-whats amber when its pillar RAG is amber", () => {
    // October's TRevPAR and Margin pillars are "on track" in words but amber in
    // the review; the commentary under them must not come out green.
    const items = soWhatItems([{ id: "1", headline: "YTD TRevPAR growth remains positive, October softened", body: null, tone: null }]);
    const html = renderToStaticMarkup(<SoWhatList items={items} tone={toneForRag("AMBER")} />);
    expect(html).toContain('data-so-what-tone="warning"');
    expect(html).toContain("border-warn");
    expect(html).not.toContain("border-ok");
  });
});
