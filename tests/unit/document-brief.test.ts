import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/chat-runtime", () => ({
  completeConfiguredJson: vi.fn(),
}));

import {
  documentBriefInstructions,
  heuristicDocumentBrief,
  parseDocumentBrief,
} from "@/lib/forms/document-brief";
import { defaultWhatWasRead } from "@/lib/forms/document-brief-schema";
import { isStartFillingUtterance } from "@/lib/forms/start-filling";
import { selectFormLikePageNumbers } from "@/lib/forms/form-like-pages";

it("classifies a municipal accounting tender from extractable text", () => {
  const brief = heuristicDocumentBrief(
    [
      "INVITATION TO TENDER",
      "Appointment of a registered accounting firm",
      "Issued by City of Tshwane",
      "Bid number: TSW/ACC/01",
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
  expect(brief.summary).toMatch(/\n\n/);
  expect(brief.keyFacts.join(" ")).toMatch(/TSW\/ACC\/01/);
  expect(brief.parties.some((party) => /City of Tshwane/i.test(party.name))).toBe(
    true,
  );
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
  expect(brief.sections).toEqual([]);
  expect(brief.whatWasRead.note).toMatch(/extractable text/i);
});

it("keeps a long outline, parties, and coverage from JSON", () => {
  const brief = parseDocumentBrief(
    {
      title: "Accounting tender",
      kind: "tender",
      summary: "Para one.\n\nPara two about scope.",
      outline: ["Invitation", "Scope of work", "SBD forms"],
      keyFacts: ["Bid number: TSW/ACC/01"],
      parties: [{ role: "Issuer", name: "City of Tshwane" }, "National Treasury"],
      eligibility: "Registered firms",
      deadlines: ["12 December 2026"],
      attachments: ["CSD"],
      actionsNow: ["Attend briefing"],
      implications: ["Late bids fail"],
      fillableSections: ["SBD1"],
      whatWasRead: { pagesRead: 999, pageCount: 1, truncated: false, note: "Funda amakhasi okuqala angu-80 kwezi-120." },
    },
    defaultWhatWasRead(80, 120, true),
  );
  expect(brief.documentKind).toBe("tender");
  expect(brief.sections).toEqual(["Invitation", "Scope of work", "SBD forms"]);
  expect(brief.parties).toEqual([
    { role: "Issuer", name: "City of Tshwane" },
    { role: "Party", name: "National Treasury" },
  ]);
  expect(brief.requiredAttachments).toEqual(["CSD"]);
  expect(brief.whatWasRead.pagesRead).toBe(80);
  expect(brief.whatWasRead.pageCount).toBe(120);
  expect(brief.whatWasRead.truncated).toBe(true);
  expect(brief.whatWasRead.note).toMatch(/Funda amakhasi/);
});

it("asks the model to brief in the selected official language", () => {
  expect(documentBriefInstructions("zul")).toMatch(/isiZulu/);
  expect(documentBriefInstructions("afr")).toMatch(/Afrikaans/);
  expect(documentBriefInstructions("eng")).toMatch(/English/);
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
