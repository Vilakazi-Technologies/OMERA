import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/chat-runtime", () => ({
  completeConfiguredJson: vi.fn(),
}));

import {
  heuristicDocumentBrief,
  parseDocumentBrief,
} from "@/lib/forms/document-brief";
import { isStartFillingUtterance } from "@/lib/forms/start-filling";
import { selectFormLikePageNumbers } from "@/lib/forms/form-like-pages";

it("classifies a municipal accounting tender from extractable text", () => {
  const brief = heuristicDocumentBrief(
    [
      "INVITATION TO TENDER",
      "Appointment of a registered accounting firm",
      "Closing date: 12 December 2026 at 11:00",
      "Compulsory briefing 20 November 2026",
      "CSD registration and B-BBEE certificate required",
      "Returnable: SBD1 SBD4 SBD6.1",
    ].join("\n"),
    "accounting-tender.pdf",
  );
  expect(brief.documentKind).toBe("tender");
  expect(brief.deadlines.join(" ")).toMatch(/Closing date/i);
  expect(brief.requiredAttachments.join(" ")).toMatch(/CSD/i);
  expect(brief.fillableSections).toEqual(
    expect.arrayContaining(["SBD1", "SBD4", "SBD6.1"]),
  );
  expect(brief.actionsNow.length).toBeGreaterThan(0);
});

it("accepts slightly messy briefing JSON", () => {
  const brief = parseDocumentBrief({
    title: "RFQ for laptops",
    documentKind: "Request for quotation",
    summary: "Supply of laptops.",
    eligibility: "CSD-registered suppliers",
    deadlines: ["Close 1 Dec"],
    requiredAttachments: ["Tax PIN"],
    actionsNow: ["Complete SBD1"],
    implications: ["Late bids fail"],
    fillableSections: ["SBD1"],
  });
  expect(brief.documentKind).toBe("rfq");
  expect(brief.title).toBe("RFQ for laptops");
});

it("treats start-filling phrases as confirmation", () => {
  expect(isStartFillingUtterance("start filling")).toBe(true);
  expect(isStartFillingUtterance("Fill in the form")).toBe(true);
  expect(isStartFillingUtterance("yes")).toBe(true);
  expect(isStartFillingUtterance("what is a tender")).toBe(false);
});

it("picks SBD and blank pages over narrative for vision", () => {
  const pages = selectFormLikePageNumbers(
    [
      { pageNumber: 1, text: "Invitation to tender for accounting services" },
      { pageNumber: 2, text: "Scope of work. The bidder shall provide monthly management accounts." },
      { pageNumber: 3, text: "SBD1\nCompany name: ______\nCSD number: ______\nSignature: ______" },
    ],
    2,
  );
  expect(pages[0]).toBe(1);
  expect(pages).toContain(3);
});
