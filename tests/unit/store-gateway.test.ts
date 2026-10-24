import { describe, expect, it } from "vitest";
import { safeEqual } from "@/lib/store-gateway/authorize";

describe("store gateway secret", () => {
  it("accepts an equal secret", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });
  it("rejects a different secret", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
  });
  it("rejects a length mismatch without throwing", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
