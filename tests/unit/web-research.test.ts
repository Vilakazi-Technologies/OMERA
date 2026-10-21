import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildGoogleSearchQuery,
  formatWebResearchContext,
  shouldResearchOnGoogle,
} from "@/lib/search/web-research";

vi.mock("server-only", () => ({}));

describe("shouldResearchOnGoogle", () => {
  it("skips greetings and runs for substantive messages", () => {
    expect(shouldResearchOnGoogle("hi")).toBe(false);
    expect(shouldResearchOnGoogle("Thanks!")).toBe(false);
    expect(
      shouldResearchOnGoogle("What is the CIPC annual return fee in 2026?"),
    ).toBe(true);
    expect(
      shouldResearchOnGoogle("Help me price tutoring in Johannesburg"),
    ).toBe(true);
  });
});

describe("buildGoogleSearchQuery", () => {
  it("uses the first line and caps length", () => {
    expect(buildGoogleSearchQuery("Line one\nLine two")).toBe("Line one");
    expect(buildGoogleSearchQuery("  spaced   words  ")).toBe("spaced words");
  });

  it("strips google command phrasing", () => {
    expect(buildGoogleSearchQuery("The AI must Google VILATECH")).toBe(
      "VILATECH",
    );
  });
});

describe("formatWebResearchContext", () => {
  it("formats hits with URLs", () => {
    const block = formatWebResearchContext(
      "CIPC fees",
      [
        {
          title: "CIPC",
          link: "https://www.cipc.co.za/",
          snippet: "Company registration",
        },
      ],
      "2026-03-20T12:00:00Z",
    );
    expect(block).toContain("Google web search");
    expect(block).toContain("https://www.cipc.co.za/");
    expect(block).toContain("CIPC fees");
  });

  it("returns guidance when there are no hits", () => {
    const block = formatWebResearchContext("vilatech", [], "2026-03-20T12:00:00Z");
    expect(block).toContain("no results");
    expect(block).toContain("NEVER say you cannot browse");
  });
});

describe("googleCustomSearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed hits when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [
            {
              title: "Example",
              link: "https://example.com/page",
              snippet: "Snippet text",
            },
          ],
        }),
      ),
    );
    const { googleCustomSearch } = await import(
      "@/lib/search/google-custom-search"
    );
    const hits = await googleCustomSearch("example query", undefined, {
      GOOGLE_SEARCH_API_KEY: "key",
      GOOGLE_SEARCH_ENGINE_ID: "cx",
    });
    expect(hits).toEqual([
      {
        title: "Example",
        link: "https://example.com/page",
        snippet: "Snippet text",
      },
    ]);
  });
});
