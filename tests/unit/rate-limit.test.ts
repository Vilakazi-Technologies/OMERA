import { beforeEach, describe, expect, it } from "vitest";
import { allowRequest, clearRateLimits } from "@/lib/limits/rate-limit";

beforeEach(() => clearRateLimits());

describe("fixed-window limiter", () => {
  it("allows the limit and blocks the next request", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(allowRequest("k", 3, 1000, 1000)).toBe(true);
    }
    expect(allowRequest("k", 3, 1000, 1000)).toBe(false);
  });

  it("resets after the window", () => {
    allowRequest("k", 1, 1000, 1000);
    expect(allowRequest("k", 1, 1000, 1000)).toBe(false);
    expect(allowRequest("k", 1, 1000, 2001)).toBe(true);
  });

  it("keeps keys independent", () => {
    allowRequest("a", 1, 1000, 1000);
    expect(allowRequest("b", 1, 1000, 1000)).toBe(true);
  });
});
