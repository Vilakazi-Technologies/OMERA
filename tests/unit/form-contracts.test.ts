import { expect, it } from "vitest";
import {
  parseStrictXavaniFields,
  type CanonicalFieldDef,
} from "@/lib/forms/contracts";

const DEFS: CanonicalFieldDef[] = [
  { id: "full_name", kind: "text", required: true },
  { id: "permission", kind: "checkbox", required: false },
  { id: "method", kind: "choice", required: false, options: ["Email", "Phone"] },
];

function responseFor(
  ids: Array<{ id: string; label?: string; prompt?: string; options?: string[] }>,
) {
  return {
    fields: ids.map((entry) => ({
      label: `Label ${entry.id}`,
      prompt: `Question for ${entry.id}?`,
      ...entry,
    })),
  };
}

it("a_duplicate_field_id_is_rejected", () => {
  const response = responseFor([
    { id: "full_name" },
    { id: "full_name" },
    { id: "permission" },
    { id: "method" },
  ]);
  expect(() => parseStrictXavaniFields(response, DEFS)).toThrow(
    "DUPLICATE_FIELD_ID",
  );
});

it("an_added_field_id_is_rejected", () => {
  const response = responseFor([
    { id: "full_name" },
    { id: "permission" },
    { id: "method" },
    { id: "invented_field" },
  ]);
  expect(() => parseStrictXavaniFields(response, DEFS)).toThrow(
    "ADDED_FIELD_ID",
  );
});

it("an_omitted_field_id_is_rejected", () => {
  const response = responseFor([{ id: "full_name" }, { id: "permission" }]);
  expect(() => parseStrictXavaniFields(response, DEFS)).toThrow(
    "OMITTED_FIELD_ID",
  );
});

it("an_invalid_option_is_rejected", () => {
  const response = responseFor([
    { id: "full_name" },
    { id: "permission" },
    { id: "method", options: ["Email", "Carrier pigeon"] },
  ]);
  expect(() => parseStrictXavaniFields(response, DEFS)).toThrow(
    "INVALID_OPTION",
  );
});

it("exact_coverage_passes", () => {
  const response = responseFor([
    { id: "full_name" },
    { id: "permission" },
    { id: "method", options: ["Email", "Phone"] },
  ]);
  expect(parseStrictXavaniFields(response, DEFS)).toStrictEqual([
    { id: "full_name", label: "Label full_name", prompt: "Question for full_name?" },
    { id: "permission", label: "Label permission", prompt: "Question for permission?" },
    { id: "method", label: "Label method", prompt: "Question for method?" },
  ]);
});
