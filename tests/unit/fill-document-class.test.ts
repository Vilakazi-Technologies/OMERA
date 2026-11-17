import { expect, it } from "vitest";
import {
  detectFillDocumentClass,
  FILL_DOCUMENT_CLASSES,
  fillClassPromptHint,
  toBriefDocumentKind,
} from "@/lib/forms/fill-document-class";

it("exposes rfp, rfq, rfb, rfi, eoi, bid, quotation, proposal, application, and form", () => {
  expect([...FILL_DOCUMENT_CLASSES]).toEqual([
    "rfp",
    "rfq",
    "rfb",
    "rfi",
    "eoi",
    "bid",
    "quotation",
    "proposal",
    "application",
    "form",
  ]);
});

it("classifies RFP, RFPO, RFQ, bid, quotation, application, and generic forms", () => {
  expect(detectFillDocumentClass("REQUEST FOR PROPOSAL\nRFQ NO :PR10069056")).toBe(
    "rfp",
  );
  expect(detectFillDocumentClass("RFPO for website redevelopment")).toBe("rfp");
  expect(detectFillDocumentClass("R.F.P.O. appointment of a service provider")).toBe(
    "rfp",
  );
  expect(detectFillDocumentClass("Reqest for proposel — GPL website")).toBe("rfp");
  expect(detectFillDocumentClass("Versoek om voorstel")).toBe("rfp");
  expect(detectFillDocumentClass("REQUEST FOR QUOTATION\nRFQ NO: Q-1")).toBe("rfq");
  expect(detectFillDocumentClass("Request for qoutation of laptops")).toBe("rfq");
  expect(detectFillDocumentClass("Please send a quotation for laptops")).toBe(
    "quotation",
  );
  expect(detectFillDocumentClass("INVITATION TO BID\nBid number: TSW/01")).toBe(
    "bid",
  );
  expect(detectFillDocumentClass("Invitiation to bid SBD1")).toBe("bid");
  expect(detectFillDocumentClass("Municipal MBD 4 declaration")).toBe("bid");
  expect(detectFillDocumentClass("SBD4 bidders disclosure")).toBe("bid");
  expect(detectFillDocumentClass("Application for leave")).toBe("application");
  expect(detectFillDocumentClass("Full name: ______\nDate: ______")).toBe("form");
});

it("classifies RFB, RFI, EOI, and standalone proposals", () => {
  expect(detectFillDocumentClass("REQUEST FOR BID RFB 12/2026")).toBe("rfb");
  expect(detectFillDocumentClass("Request for Information RFI-IT-09")).toBe("rfi");
  expect(detectFillDocumentClass("Expression of Interest EOI for facilities")).toBe(
    "eoi",
  );
  expect(detectFillDocumentClass("Expresion of interest — cleaning services")).toBe(
    "eoi",
  );
  expect(detectFillDocumentClass("Project proposal template\nClient: ______")).toBe(
    "proposal",
  );
});

it("maps fill classes onto briefing kinds", () => {
  expect(toBriefDocumentKind("bid")).toBe("tender");
  expect(toBriefDocumentKind("rfb")).toBe("tender");
  expect(toBriefDocumentKind("quotation")).toBe("rfq");
  expect(toBriefDocumentKind("rfp")).toBe("rfp");
  expect(toBriefDocumentKind("proposal")).toBe("rfp");
  expect(toBriefDocumentKind("rfi")).toBe("other");
  expect(toBriefDocumentKind("eoi")).toBe("other");
  expect(toBriefDocumentKind("form")).toBe("form");
  expect(fillClassPromptHint("form")).toMatch(/generic fill-in form/i);
});
