import { describe, expect, it } from "vitest";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";

describe("API errors", () => {
  it("preserves an approved code and status", async () => {
    const response = apiErrorResponse(new ApiError("INVALID_REQUEST", 400));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("hides an unexpected exception", async () => {
    const response = apiErrorResponse(new Error("SYNTHETIC_PRIVATE_ERROR"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "SERVICE_UNAVAILABLE" });
  });
});
