import { expect, it } from "vitest";
import { fallbackFormFields, humanizeFieldId } from "@/lib/forms/field-labels";

it("humanizes_pdf_field_ids", () => {
  expect(humanizeFieldId("full_name")).toBe("Full name");
  expect(humanizeFieldId("employerName")).toBe("Employer Name");
});

it("builds_fallback_fields_without_ai", () => {
  const fields = fallbackFormFields([
    { id: "tax_number", kind: "text", required: true, initialValue: "" },
  ]);
  expect(fields[0].label).toBe("Tax number");
  expect(fields[0].required).toBe(true);
});
