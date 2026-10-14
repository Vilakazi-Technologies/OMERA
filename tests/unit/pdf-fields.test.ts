import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { expect, it } from "vitest";
import { fillPdfFields, inspectPdfFields } from "@/lib/forms/pdf-fields";

async function fixture() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  const form = pdf.getForm();
  const name = form.createTextField("applicant.full_name");
  name.enableRequired();
  name.addToPage(page, { x: 40, y: 700, width: 350, height: 24 });
  const checkbox = form.createCheckBox("contact.permission");
  checkbox.addToPage(page, { x: 40, y: 650, width: 20, height: 20 });
  const dropdown = form.createDropdown("business.type");
  dropdown.addOptions(["Service", "Retail"]);
  dropdown.addToPage(page, { x: 40, y: 600, width: 200, height: 24 });
  const radio = form.createRadioGroup("contact.method");
  radio.addOptionToPage("Email", page, { x: 40, y: 550, width: 20, height: 20 });
  radio.addOptionToPage("Phone", page, { x: 80, y: 550, width: 20, height: 20 });
  return pdf.save();
}

it("writes exact answers into the original PDF fields", async () => {
  const source = await fixture();
  const fields = await inspectPdfFields(source);
  expect(fields.map((field) => field.id)).toEqual([
    "applicant.full_name", "contact.permission", "business.type", "contact.method",
  ]);
  const font = new Uint8Array(await readFile("assets/fonts/NotoSans-Regular.ttf"));
  const output = await fillPdfFields(source, {
    "applicant.full_name": "Ṱhendo Muḓau",
    "contact.permission": false,
    "business.type": "Service",
    "contact.method": "Email",
  }, font);
  const pdf = await PDFDocument.load(output);
  const form = pdf.getForm();
  expect(pdf.getPageCount()).toBe(1);
  expect(form.getTextField("applicant.full_name").getText()).toBe("Ṱhendo Muḓau");
  expect(form.getCheckBox("contact.permission").isChecked()).toBe(false);
  expect(form.getDropdown("business.type").getSelected()).toEqual(["Service"]);
  expect(form.getRadioGroup("contact.method").getSelected()).toBe("Email");
});

it("rejects missing required values and unknown mappings", async () => {
  const source = await fixture();
  const font = new Uint8Array(await readFile("assets/fonts/NotoSans-Regular.ttf"));
  await expect(fillPdfFields(source, {}, font)).rejects.toThrow("REQUIRED_FIELD");
  await expect(fillPdfFields(source, { wrong: "value" }, font)).rejects.toThrow("UNKNOWN_FIELD");
  await expect(fillPdfFields(source, {
    "applicant.full_name": "Thabo", "business.type": "Unknown",
  }, font)).rejects.toThrow("INVALID_CHOICE");
  await expect(inspectPdfFields(new Uint8Array([1, 2, 3]))).rejects.toThrow("INVALID_PDF");
});


// C10-A characterization: these added contracts first run against pinned source.
const choiceOptions = ["Service", "Retail", "service", "  00123  "];
const radioOptions = ["Email", "Phone", "email", "  00123  "];
const fontFixture = readFile("assets/fonts/NotoSans-Regular.ttf")
  .then((bytes) => new Uint8Array(bytes));

type ContractField = "name" | "permission" | "category" | "method";

async function contractFixture(options: {
  required?: ContractField;
  empty?: boolean;
  maxLength?: number;
  textId?: string;
} = {}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  pdf.addPage([300, 400]);
  const form = pdf.getForm();
  const name = form.createTextField(options.textId ?? "name");
  name.setMaxLength(options.maxLength ?? 24);
  if (!options.empty) name.setText("00123");
  name.addToPage(page, { x: 40, y: 700, width: 350, height: 24 });
  const permission = form.createCheckBox("permission");
  if (!options.empty) permission.check();
  permission.addToPage(page, { x: 40, y: 650, width: 20, height: 20 });
  const category = form.createDropdown("category");
  category.addOptions(choiceOptions);
  if (!options.empty) category.select("Retail");
  category.addToPage(page, { x: 40, y: 600, width: 200, height: 24 });
  const method = form.createRadioGroup("method");
  for (const [index, value] of radioOptions.entries()) {
    method.addOptionToPage(value, page, {
      x: 40 + index * 40, y: 550, width: 20, height: 20,
    });
  }
  if (!options.empty) method.select("Phone");
  if (options.required) form.getField(options.required).enableRequired();
  return pdf.save();
}

async function readFilled(source: Uint8Array, answers: Record<string, string | boolean>) {
  const output = await fillPdfFields(source, answers, await fontFixture);
  const pdf = await PDFDocument.load(output);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPages().map((page) => page.getSize())).toEqual([
    { width: 600, height: 800 }, { width: 300, height: 400 },
  ]);
  expect(pdf.getForm().getFields().map((field) => field.getName())).toEqual([
    "name", "permission", "category", "method",
  ]);
  return pdf.getForm();
}

it("describes exact IDs, kinds, flags, initial values, options and maxLength", async () => {
  const source = await contractFixture({ required: "name" });
  expect(await inspectPdfFields(source)).toStrictEqual([
    { id: "name", kind: "text", required: true, initialValue: "00123", maxLength: 24 },
    { id: "permission", kind: "checkbox", required: false, initialValue: true },
    { id: "category", kind: "choice", required: false, initialValue: "Retail", options: choiceOptions },
    { id: "method", kind: "choice", required: false, initialValue: "Phone", options: radioOptions },
  ]);
});

it("describes empty text, unchecked boxes and unselected choices", async () => {
  expect(await inspectPdfFields(await contractFixture({ empty: true }))).toStrictEqual([
    { id: "name", kind: "text", required: false, initialValue: "", maxLength: 24 },
    { id: "permission", kind: "checkbox", required: false, initialValue: false },
    { id: "category", kind: "choice", required: false, initialValue: "", options: choiceOptions },
    { id: "method", kind: "choice", required: false, initialValue: "", options: radioOptions },
  ]);
});

it("describes unconstrained text with an undefined maxLength", async () => {
  const source = await fixture();
  const fields = await inspectPdfFields(source);
  expect(fields.find((field) => field.id === "applicant.full_name")).toStrictEqual({
    id: "applicant.full_name", kind: "text", required: true, initialValue: "", maxLength: undefined,
  });
});

it.each(["  Ṱhendo Muḓau  ", "00123", "MiXeD CaSe", "e\u0301", "  ", ""])(
  "preserves exact text %j without normalization or inference", async (value) => {
    const form = await readFilled(await contractFixture(), { name: value });
    expect(form.getTextField("name").getText() ?? "").toBe(value);
  },
);

it.each([true, false])("writes the exact optional checkbox value %s", async (value) => {
  const form = await readFilled(await contractFixture(), { permission: value });
  expect(form.getCheckBox("permission").isChecked()).toBe(value);
});

it.each(choiceOptions)("writes exact dropdown choice %j", async (value) => {
  const form = await readFilled(await contractFixture(), { category: value });
  expect(form.getDropdown("category").getSelected()).toEqual([value]);
});

it.each(radioOptions)("writes exact radio choice %j", async (value) => {
  const form = await readFilled(await contractFixture(), { method: value });
  expect(form.getRadioGroup("method").getSelected()).toBe(value);
});

it("preserves all initial values when answers are absent", async () => {
  const form = await readFilled(await contractFixture(), {});
  expect(form.getTextField("name").getText()).toBe("00123");
  expect(form.getCheckBox("permission").isChecked()).toBe(true);
  expect(form.getDropdown("category").getSelected()).toEqual(["Retail"]);
  expect(form.getRadioGroup("method").getSelected()).toBe("Phone");
});

it("clears optional dropdown and radio choices instead of preserving selections", async () => {
  const form = await readFilled(await contractFixture(), { category: "", method: "" });
  expect(form.getDropdown("category").getSelected()).toEqual([]);
  expect(form.getRadioGroup("method").getSelected()).toBeUndefined();
});

it.each<ContractField>(["name", "permission", "category", "method"])(
  "rejects an absent required %s with no initial value", async (required) => {
    const source = await contractFixture({ required, empty: true });
    expect((await inspectPdfFields(source)).find((field) => field.id === required)?.required).toBe(true);
    await expect(fillPdfFields(source, {}, await fontFixture)).rejects.toThrow("REQUIRED_FIELD");
  },
);

it.each<ContractField>(["name", "permission", "category", "method"])(
  "rejects an explicit empty required %s despite a valid initial value", async (required) => {
    const source = await contractFixture({ required });
    const value = required === "permission" ? false : "";
    await expect(fillPdfFields(source, { [required]: value }, await fontFixture))
      .rejects.toThrow("REQUIRED_FIELD");
  },
);

it.each<ContractField>(["name", "permission", "category", "method"])(
  "accepts a valid required %s initial value when no answer is supplied", async (required) => {
    const form = await readFilled(await contractFixture({ required }), {});
    expect(form.getTextField("name").getText()).toBe("00123");
    expect(form.getCheckBox("permission").isChecked()).toBe(true);
    expect(form.getDropdown("category").getSelected()).toEqual(["Retail"]);
    expect(form.getRadioGroup("method").getSelected()).toBe("Phone");
  },
);

it.each([" ", "\t\n"])("rejects whitespace-only required text %j", async (value) => {
  const source = await contractFixture({ required: "name" });
  await expect(fillPdfFields(source, { name: value }, await fontFixture)).rejects.toThrow("REQUIRED_FIELD");
});

it("accepts true for a required checkbox", async () => {
  const form = await readFilled(await contractFixture({ required: "permission", empty: true }), {
    permission: true,
  });
  expect(form.getCheckBox("permission").isChecked()).toBe(true);
});

const invalidRuntimeValues: unknown[] = [null, undefined, 123, [], {}];
it.each(invalidRuntimeValues)("rejects non-string runtime text %j", async (value) => {
  const answers = { name: value } as unknown as Record<string, string | boolean>;
  await expect(fillPdfFields(await contractFixture(), answers, await fontFixture)).rejects.toThrow("INVALID_TEXT");
});

it.each([false, true])("rejects boolean runtime text %s", async (value) => {
  await expect(fillPdfFields(await contractFixture(), { name: value }, await fontFixture)).rejects.toThrow("INVALID_TEXT");
});

it.each([...invalidRuntimeValues, "false", "true", ""])(
  "rejects non-boolean runtime checkbox %j", async (value) => {
    const answers = { permission: value } as unknown as Record<string, string | boolean>;
    await expect(fillPdfFields(await contractFixture(), answers, await fontFixture)).rejects.toThrow("INVALID_CHECKBOX");
  },
);

it.each(["category", "method"])("rejects runtime non-string %s choices", async (id) => {
  const source = await contractFixture();
  for (const value of [...invalidRuntimeValues, false, true]) {
    const answers = { [id]: value } as unknown as Record<string, string | boolean>;
    await expect(fillPdfFields(source, answers, await fontFixture)).rejects.toThrow("INVALID_TEXT");
  }
});

it.each([
  ["category", "SERVICE"], ["category", " Service "], ["category", "Unknown"],
  ["method", "EMAIL"], ["method", " Email "], ["method", "Unknown"],
])("rejects %s choice %j without case folding or trimming", async (id, value) => {
  await expect(fillPdfFields(await contractFixture(), { [id]: value }, await fontFixture))
    .rejects.toThrow("INVALID_CHOICE");
});

it("accepts exact maxLength, retaining every leading zero", async () => {
  const form = await readFilled(await contractFixture({ maxLength: 5 }), { name: "00012" });
  expect(form.getTextField("name").getText()).toBe("00012");
});

it("rejects text one character beyond maxLength", async () => {
  await expect(fillPdfFields(await contractFixture({ maxLength: 5 }), { name: "000123" }, await fontFixture))
    .rejects.toThrow("VALUE_TOO_LONG");
});

it.each(["wrong", "Name", " name ", "constructor", "__proto__"])(
  "rejects unknown own mapping %j", async (id) => {
    const answers = Object.create(null) as Record<string, string | boolean>;
    answers[id] = "00123";
    expect(Object.prototype.hasOwnProperty.call(answers, id)).toBe(true);
    await expect(fillPdfFields(await contractFixture(), answers, await fontFixture)).rejects.toThrow("UNKNOWN_FIELD");
  },
);

it.each(["__proto__", "constructor", "toString"])(
  "fills an exact prototype-sensitive field ID %j using an own property", async (id) => {
    const answers = Object.create(null) as Record<string, string | boolean>;
    answers[id] = "00123";
    expect(Object.prototype.hasOwnProperty.call(answers, id)).toBe(true);
    const source = await contractFixture({ textId: id });
    const output = await fillPdfFields(source, answers, await fontFixture);
    const pdf = await PDFDocument.load(output);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getForm().getFields().map((field) => field.getName())).toEqual([
      id, "permission", "category", "method",
    ]);
    expect(pdf.getForm().getTextField(id).getText()).toBe("00123");
  },
);

it("ignores inherited answers and preserves the initial field value", async () => {
  const answers = Object.create({ name: "wrong inherited answer" }) as Record<string, string | boolean>;
  expect(Object.prototype.hasOwnProperty.call(answers, "name")).toBe(false);
  const form = await readFilled(await contractFixture(), answers);
  expect(form.getTextField("name").getText()).toBe("00123");
});

it("keeps every input and font byte unchanged, including Uint8Array subview guards", async () => {
  const source = await contractFixture();
  const font = await fontFixture;
  const sourceBacking = new Uint8Array(source.length + 16).fill(0xa5);
  const fontBacking = new Uint8Array(font.length + 16).fill(0x5a);
  sourceBacking.set(source, 8);
  fontBacking.set(font, 8);
  const sourceView = sourceBacking.subarray(8, 8 + source.length);
  const fontView = fontBacking.subarray(8, 8 + font.length);
  const sourceBefore = Buffer.from(sourceBacking);
  const fontBefore = Buffer.from(fontBacking);
  expect((await inspectPdfFields(sourceView)).map((field) => field.id)).toEqual([
    "name", "permission", "category", "method",
  ]);
  expect(Buffer.compare(Buffer.from(sourceBacking), sourceBefore)).toBe(0);
  const output = await fillPdfFields(sourceView, { name: "Ṱhendo Muḓau", permission: false }, fontView);
  expect(Buffer.compare(Buffer.from(sourceBacking), sourceBefore)).toBe(0);
  expect(Buffer.compare(Buffer.from(fontBacking), fontBefore)).toBe(0);
  const pdf = await PDFDocument.load(output);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getForm().getFields().map((field) => field.getName())).toEqual([
    "name", "permission", "category", "method",
  ]);
  expect(pdf.getForm().getTextField("name").getText()).toBe("Ṱhendo Muḓau");
  expect(pdf.getForm().getCheckBox("permission").isChecked()).toBe(false);
  expect(pdf.getForm().getDropdown("category").getSelected()).toEqual(["Retail"]);
  expect(pdf.getForm().getRadioGroup("method").getSelected()).toBe("Phone");
});
