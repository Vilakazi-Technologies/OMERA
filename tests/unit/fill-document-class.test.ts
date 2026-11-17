import { expect, it } from "vitest";
import {
  detectFillDocumentClass,
  toBriefDocumentKind,
} from "@/lib/forms/fill-document-class";

it("classifies RFP, RFQ, bid, quotation, application, and generic forms", () => {
  expect(detectFillDocumentClass("REQUEST FOR PROPOSAL\nRFQ NO :PR10069056")).toBe(
    "rfp",
  );
  expect(detectFillDocumentClass("RFPO for website redevelopment")).toBe("rfp");
  expect(detectFillDocumentClass("REQUEST FOR QUOTATION\nRFQ NO: Q-1")).toBe("rfq");
  expect(detectFillDocumentClass("Please send a quotation for laptops")).toBe(
    "quotation",
  );
  expect(detectFillDocumentClass("INVITATION TO BID\nBid number: TSW/01")).toBe(
    "bid",
  );
  expect(detectFillDocumentClass("Municipal MBD 4 declaration")).toBe("bid");
  expect(detectFillDocumentClass("Application for leave")).toBe("application");
  expect(detectFillDocumentClass("Full name: ______\nDate: ______")).toBe("form");
});

it("maps fill classes onto briefing kinds", () => {
  expect(toBriefDocumentKind("bid")).toBe("tender");
  expect(toBriefDocumentKind("quotation")).toBe("rfq");
  expect(toBriefDocumentKind("rfp")).toBe("rfp");
  expect(toBriefDocumentKind("form")).toBe("form");
});
