import { beforeEach, expect, it } from "vitest";
import {
  clearRegistry,
  registerTemplate,
  templateFingerprint,
} from "@/lib/forms/templates";
import { resolveRectangles } from "@/lib/forms/render-template";

beforeEach(() => {
  clearRegistry();
});

it("an_unknown_fingerprint_is_rejected", () => {
  // The registry starts empty (gate G4): no coordinates are ever invented.
  expect(() =>
    resolveRectangles(new TextEncoder().encode("unrecognized scan bytes")),
  ).toThrow("UNKNOWN_TEMPLATE");
});

it("an_approved_fingerprint_loads_its_rectangles", () => {
  const bytes = new TextEncoder().encode("owner-approved flat form");
  registerTemplate({
    fingerprint: templateFingerprint(bytes),
    name: "owner-approved flat form",
    rects: [
      { fieldId: "full_name", page: 0, x: 40, y: 700, width: 350, height: 24 },
      { fieldId: "signature", page: 1, x: 40, y: 120, width: 200, height: 40, rotation: 90 },
    ],
  });
  expect(resolveRectangles(bytes)).toStrictEqual([
    { fieldId: "full_name", page: 0, x: 40, y: 700, width: 350, height: 24, rotation: 0 },
    { fieldId: "signature", page: 1, x: 40, y: 120, width: 200, height: 40, rotation: 90 },
  ]);
});
