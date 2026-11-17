import { expect, it } from "vitest";
import {
  isAnswerOrAttachItem,
  isBoilerplateInstruction,
  isJunkFragment,
  isModelFillItem,
} from "@/lib/forms/fill-item-filter";

it("never treats disqualification scraps as fill-in questions", () => {
  expect(
    isBoilerplateInstruction(
      "the paid will be disqualified automatically",
      "the paid will be disqualified automatically",
      "the bid will be disqualified automatically:",
    ),
  ).toBe(true);
  expect(
    isModelFillItem(
      "the paid will be disqualified automatically",
      "What is your paid",
    ),
  ).toBe(false);
  expect(isJunkFragment("paid")).toBe(true);
  expect(
    isAnswerOrAttachItem(
      "the bid will be disqualified automatically",
      "the paid will be disqualified automatically:",
    ),
  ).toBe(false);
});

it("keeps real tender blanks and SBD returnables", () => {
  expect(isAnswerOrAttachItem("NAME OF BIDDER", "NAME OF BIDDER: …………")).toBe(
    true,
  );
  expect(isAnswerOrAttachItem("SBD 4", "Bidders Disclosure (SBD 4)")).toBe(true);
  expect(isModelFillItem("CSD number", "What is the CSD number?")).toBe(true);
});

it("keeps a box after a colon as a real fill-in", () => {
  expect(isAnswerOrAttachItem("Consent", "Consent: [ ]")).toBe(true);
});

it("keeps ordinary form labels so generic PDFs are not over-filtered", () => {
  expect(isAnswerOrAttachItem("Full name", "Full name: ______")).toBe(true);
  expect(isAnswerOrAttachItem("Department", "Department: ______")).toBe(true);
  expect(isAnswerOrAttachItem("Employee number", "Employee number: ______")).toBe(
    true,
  );
  expect(isModelFillItem("First name", "What is your first name?")).toBe(true);
  expect(isModelFillItem("Email address", "What is the email address?")).toBe(
    true,
  );
});
