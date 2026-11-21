import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/chat-runtime", () => ({
  completeConfiguredJson: vi.fn(),
}));

import { completeConfiguredJson } from "@/lib/ai/chat-runtime";
import {
  buildDocumentBrief,
  documentBriefInstructions,
  emptyDocumentBrief,
  heuristicDocumentBrief,
  looksLikeReadableExtract,
  parseDocumentBrief,
} from "@/lib/forms/document-brief";
import { defaultWhatWasRead } from "@/lib/forms/document-brief-schema";
import { isStartFillingUtterance } from "@/lib/forms/start-filling";
import { selectFormLikePageNumbers } from "@/lib/forms/form-like-pages";

it("heuristic briefing names AcroForm widgets when AI is unavailable", () => {
  const brief = heuristicDocumentBrief(
    "Gauteng Provincial Legislature request for proposal.",
    "Gauteng Tender.pdf",
    undefined,
    [
      { label: "Name of bidder" },
      { label: "CSD number" },
      { label: "Signature" },
    ],
  );
  expect(brief.summary).toMatch(/Name of bidder/);
  expect(brief.fillableSections).toEqual(
    expect.arrayContaining(["Name of bidder", "CSD number"]),
  );
  expect(brief.actionsNow.join(" ")).toMatch(/Complete the returnable|Name of bidder/i);
});

const GPL_RFP_HEADER = [
  "REQUEST FOR PROPOSAL",
  "APPOINTMENT OF A SERVICE PROVIDER TO REDEVELOP THE WEBSITE FOR THE GPL FOR A PERIOD OF TWELVE MONTHS (12) MONTHS.",
  "RFQ NO :PR10069056",
  "NON-COMPULSORY : 14 OCTOBER 2026 BRIEFING SESSION VENUE: MICROSOFT TEAMS",
  "CLOSING DATE: :19 OCTOBER 2026 TIME :11h00AM",
  "These are documents required for this bidding.",
  "2. Pricing Schedule (Firm Pricing) SBD 3.3 Yes",
  "3. Bidders Disclosure (SBD 4) Original completed and signed.",
  "NAME OF BIDDER: …………………………………………………BID NO.: ……………………..",
  "Signature: …………………………………………………...………………",
].join("\n");

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

it("briefs a GPL RFP header instead of faint-scan copy", () => {
  const brief = heuristicDocumentBrief(GPL_RFP_HEADER, "Gauteng Tender.pdf");
  expect(brief.documentKind).toBe("rfp");
  expect(brief.title).toMatch(/REQUEST FOR PROPOSAL/i);
  expect(brief.parties.some((party) => /GPL/i.test(party.name))).toBe(true);
  expect(brief.keyFacts.join(" ")).toMatch(/PR10069056/);
  expect(brief.deadlines.join(" ")).toMatch(/19 OCTOBER 2026/i);
  expect(brief.fillableSections.join(" ")).toMatch(/SBD 3\.3/);
  expect(brief.fillableSections.join(" ")).toMatch(/SBD 4/);
  expect(brief.actionsNow.join(" ")).not.toMatch(/pages look faint/i);
  expect(brief.summary).not.toMatch(/very little text/i);
  expect(brief.eligibility).not.toMatch(/^Not stated\.?$/i);
});

it("treats RFP keywords and page markers as readable even when short", () => {
  expect(looksLikeReadableExtract("REQUEST FOR PROPOSAL\nSBD 4")).toBe(true);
  expect(looksLikeReadableExtract("-- 1 of 28 --\nGPL")).toBe(true);
  expect(looksLikeReadableExtract("hi")).toBe(false);
});

it("replaces a faint-scan model brief when the extract is an RFP header", async () => {
  vi.mocked(completeConfiguredJson).mockResolvedValueOnce(
    emptyDocumentBrief("Gauteng Tender.pdf"),
  );
  const brief = await buildDocumentBrief(GPL_RFP_HEADER, {
    languageId: "eng",
    fileName: "Gauteng Tender.pdf",
    pagesRead: 1,
    pageCount: 1,
  });
  expect(brief.summary).not.toMatch(/very little text|pages look faint/i);
  expect(brief.documentKind).toBe("rfp");
});

it("never shows faint-scan copy when thousands of characters were extracted", async () => {
  vi.mocked(completeConfiguredJson).mockResolvedValueOnce(
    emptyDocumentBrief("Gauteng Tender.pdf"),
  );
  const brief = await buildDocumentBrief(`${GPL_RFP_HEADER}\n${"scope of work ".repeat(200)}`, {
    languageId: "eng",
    fileName: "Gauteng Tender.pdf",
    pagesRead: 28,
    pageCount: 28,
  });
  expect(brief.summary).not.toMatch(/very little text|pages look faint/i);
  expect(brief.documentKind).toBe("rfp");
  expect(brief.keyFacts.join(" ")).toMatch(/PR10069056/);
});

it("asks the model to brief in the selected official language", () => {
  expect(documentBriefInstructions("zul")).toMatch(/isiZulu/);
  expect(documentBriefInstructions("afr")).toMatch(/Afrikaans/);
  expect(documentBriefInstructions("eng")).toMatch(/English/);
  expect(documentBriefInstructions("eng")).toMatch(/never claim the scan is faint/i);
});

it("never returns an empty brief when the extract is readable and the model is down", async () => {
  vi.mocked(completeConfiguredJson).mockRejectedValueOnce(
    new Error("CHAT_UNAVAILABLE"),
  );
  const brief = await buildDocumentBrief(GPL_RFP_HEADER, {
    languageId: "eng",
    fileName: "Gauteng Tender.pdf",
    pagesRead: 28,
    pageCount: 28,
  });
  expect(brief.summary.trim().length).toBeGreaterThan(40);
  expect(brief.documentKind).toBe("rfp");
  expect(brief.deadlines.join(" ")).toMatch(/19 OCTOBER 2026/i);
  expect(brief.actionsNow.length).toBeGreaterThan(0);
  expect(brief.summary).not.toMatch(/very little text/i);
});

it("keeps a model briefing that understood the extract", async () => {
  vi.mocked(completeConfiguredJson).mockImplementationOnce(
    async (_system, input, parse) => {
      expect(String(input)).toMatch(/REQUEST FOR PROPOSAL/);
      expect(String(input)).toMatch(/PR10069056/);
      return parse({
        title: "Website redevelopment for the GPL",
        documentKind: "rfp",
        summary:
          "The Gauteng Provincial Legislature is procuring a twelve-month website redevelopment.\n\nBidders must complete SBD returnables and attend to the closing date.",
        keyFacts: ["RFQ NO PR10069056"],
        parties: [{ role: "Issuer", name: "Gauteng Provincial Legislature" }],
        eligibility: "Service providers able to redevelop the GPL website",
        deadlines: ["Closing date 19 OCTOBER 2026 11h00"],
        requiredAttachments: ["SBD 4", "SBD 3.3"],
        actionsNow: ["Complete SBD 4 and the pricing schedule"],
        implications: ["Late bids are typically rejected"],
        fillableSections: ["SBD 4"],
      });
    },
  );
  const brief = await buildDocumentBrief(GPL_RFP_HEADER, {
    languageId: "eng",
    fileName: "Gauteng Tender.pdf",
    pagesRead: 28,
    pageCount: 28,
  });
  expect(brief.title).toMatch(/website redevelopment/i);
  expect(brief.summary).toMatch(/twelve-month/i);
  expect(brief.parties.some((party) => /Gauteng Provincial Legislature/i.test(party.name))).toBe(
    true,
  );
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

const MATHS_ASSIGNMENT = [
  "ITMTB1-44 Assignment | Eduvos",
  "Total Marks: 100 Submission Week: Week 6",
  "This module is presented on NQF level 5.",
  "Section A",
  "Learning Objective: Apply knowledge and skills relating to integration to solve problems.",
  "Question 1 32 Marks",
  "1.1 The velocity of a particle moving along a straight line is given by v(t) = t^2 - 4t + 3.",
  "b) Set up and evaluate the definite integral representing the total distance travelled.",
].join("\n");

it("honestly names a maths assignment instead of rejecting it", () => {
  const brief = heuristicDocumentBrief(
    MATHS_ASSIGNMENT,
    "ITMTB1-44 Assignment _ Eduvos.pdf",
  );
  expect(brief.summary).toMatch(/maths assignment/i);
  expect(brief.summary).toMatch(/not a fillable form/i);
  expect(brief.fillableSections).toEqual([]);
  expect(brief.actionsNow.join(" ")).not.toMatch(/upload a form/i);
});

it("brief instructions cover academic documents honestly", () => {
  const instructions = documentBriefInstructions("eng");
  expect(instructions).toMatch(/assignment/i);
  expect(instructions).toMatch(/maths assignment on integration/i);
  expect(instructions).toMatch(/never tell the user to upload a different file/i);
});

it("allows a 20 MB upload and keeps the honest platform hint", async () => {
  const {
    FORM_PDF_FILE_LIMIT,
    FORM_PDF_FILE_LIMIT_MB,
    FORM_PDF_PLATFORM_HINT_MB,
  } = await import("@/lib/forms/pdf-limits");
  expect(FORM_PDF_FILE_LIMIT).toBe(20_000_000);
  expect(FORM_PDF_FILE_LIMIT_MB).toBe(20);
  expect(FORM_PDF_PLATFORM_HINT_MB).toBe(4.5);
});
