import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  fetchRedditResearch,
  formatRedditResearchContext,
  REDDIT_RESEARCH_TIMEOUT_MS,
  type RedditResearchItem,
} from "@/lib/search/reddit-research";

function mockPullPush(submissions: unknown[], comments: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const target = String(url);
      const data = target.includes("/submission/")
        ? { data: submissions }
        : { data: comments };
      return Response.json(data);
    }),
  );
}

describe("reddit research", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses a bounded timeout and a ten-second default", () => {
    expect(REDDIT_RESEARCH_TIMEOUT_MS).toBe(10000);
  });

  it("fetches posts and comments and keeps only relevant rows", async () => {
    mockPullPush(
      [
        {
          id: "p1",
          title: "My calculus integration assignment help",
          selftext: "I worked through the definite integral steps",
          author: "student",
          score: 12,
          num_comments: 3,
          subreddit: "learnmath",
          permalink: "/r/learnmath/comments/p1/my_post/",
          created_utc: 1700000000,
          _meta: { pullpush_scrape_utc: 1700000100 },
        },
        {
          id: "p2",
          title: "Unrelated cooking recipe",
          selftext: "Boil the pasta for ten minutes",
          score: 50,
          subreddit: "cooking",
          permalink: "/r/cooking/comments/p2/",
          created_utc: 1700000000,
        },
      ],
      [
        {
          id: "c1",
          title: "",
          body: "For integration by parts, choose u carefully",
          author: "helper",
          score: 8,
          subreddit: "learnmath",
          link_id: "t3_p1",
          created_utc: 1700000200,
        },
      ],
    );
    const items = await fetchRedditResearch(
      "calculus integration assignment",
      undefined,
      { NODE_ENV: "test" },
    );
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((item) => item.subreddit === "learnmath")).toBe(true);
    expect(items.every((item) => !item.title.includes("Unrelated"))).toBe(true);
    expect(items[0].score >= items[items.length - 1].score).toBe(true);
  });

  it("returns an empty list when the mirror fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const items = await fetchRedditResearch("integration help", undefined, {
      NODE_ENV: "test",
    });
    expect(items).toEqual([]);
  });

  it("labels cached data honestly and cites the thread", () => {
    const items: RedditResearchItem[] = [
      {
        kind: "comment",
        title: "Integration advice",
        excerpt: "Check your limits of integration",
        url: "https://www.reddit.com/comments/p1/c1",
        subreddit: "learnmath",
        score: 7,
        createdUtc: 1700000000,
        scrapedUtc: 1700000100,
      },
    ];
    const block = formatRedditResearchContext(items, "2026-11-22T12:00:00Z");
    expect(block).toContain("Reddit community research");
    expect(block).toContain("cached archive snapshot, not live Reddit");
    expect(block).toContain("not verified facts");
    expect(block).toContain("https://www.reddit.com/comments/p1/c1");
    expect(block).toContain("r/learnmath");
  });

  it("emits no block when there are no items", () => {
    expect(formatRedditResearchContext([], "2026-11-22T12:00:00Z")).toBe("");
  });
});
