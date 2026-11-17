import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { INFER_FORM_INSTRUCTIONS } from "@/lib/forms/infer-form-fields";

describe("infer form prompt", () => {
  it("forbids turning warnings into questions for every pack type", () => {
    expect(INFER_FORM_INSTRUCTIONS).toMatch(/RFP, RFPO, RFQ/);
    expect(INFER_FORM_INSTRUCTIONS).toMatch(/ordinary fillable forms/);
    expect(INFER_FORM_INSTRUCTIONS).toMatch(/Never turn boilerplate/);
    expect(INFER_FORM_INSTRUCTIONS).toMatch(/disqualified/);
    expect(INFER_FORM_INSTRUCTIONS).toMatch(/ANSWER, or DOCUMENTS they must ATTACH/);
  });
});
