import { expect, it } from "vitest";
import { mergeFillFields } from "@/lib/forms/merge-fill-fields";
import type { StoredFormField } from "@/lib/db/form-sessions";

function field(
  id: string,
  label: string,
  kind: StoredFormField["kind"] = "text",
): StoredFormField {
  return {
    id,
    label,
    type: "text",
    required: true,
    prompt: `What is the ${label}?`,
    kind,
  };
}

it("keeps AcroForm ids and adds printed blanks the widgets missed", () => {
  const merged = mergeFillFields(
    [field("full_name", "Full name")],
    [field("field_1_full_name", "Full name"), field("field_2_csd_number", "CSD number")],
  );
  expect(merged.find((row) => row.label === "Full name")?.id).toBe("full_name");
  expect(merged.map((row) => row.label)).toEqual(
    expect.arrayContaining(["Full name", "CSD number"]),
  );
});

it("does not duplicate Name when Full name already exists", () => {
  const merged = mergeFillFields(
    [field("field_1_full_name", "Full name")],
    [field("field_1_name", "Name")],
  );
  expect(merged).toHaveLength(1);
  expect(merged[0]?.label).toBe("Full name");
});
