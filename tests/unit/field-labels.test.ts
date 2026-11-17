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

it("prefers_widget_tooltips_over_field_ids", () => {
  const fields = fallbackFormFields([
    {
      id: "topmostSubform[0].f1_01",
      kind: "text",
      required: true,
      initialValue: "",
      widgetLabel: "Name of bidder",
    },
  ]);
  expect(fields[0].label).toBe("Name of bidder");
});
