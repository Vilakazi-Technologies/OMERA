import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
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
    "applicant.full_name", "contact.permission", "contact.method", "business.type",
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

import { PDFArray, PDFDict, PDFName } from "pdf-lib";

it("preserves source AcroForm traversal instead of object-number order", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const form = pdf.getForm();
  const first = form.createTextField("created.first");
  first.addToPage(page, { x: 40, y: 700, width: 120, height: 20 });
  const second = form.createTextField("other.second");
  second.addToPage(page, { x: 40, y: 660, width: 120, height: 20 });
  const roots = form.acroForm.dict.lookup(PDFName.of("Fields"), PDFArray);
  form.acroForm.dict.set(PDFName.of("Fields"), pdf.context.obj([roots.get(1), roots.get(0)]));
  const source = await pdf.save();
  const loaded = await PDFDocument.load(source);
  const expected = loaded.getForm().getFields().map((field) => field.getName());
  expect(expected).toEqual(["other.second", "created.first"]);
  expect((await inspectPdfFields(source)).map((field) => field.id)).toEqual(expected);
});

// C10-B glyph regressions exercise real PDFs and the embedded font.
it.each(["🌍", "漢"])("rejects missing text glyph %j instead of storing a replacement appearance", async (value) => {
  await expect(fillPdfFields(await contractFixture(), { name: value }, await fontFixture))
    .rejects.toThrow("UNSUPPORTED_CHARACTER");
});

async function unicodeChoiceFixture(kind: "dropdown" | "radio", options: string[]) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await fontFixture, { subset: true });
  const page = pdf.addPage([400, 300]);
  const form = pdf.getForm();
  if (kind === "dropdown") {
    const field = form.createDropdown("unicode.choice");
    field.addOptions(options);
    field.addToPage(page, { x: 30, y: 200, width: 300, height: 24, font });
  } else {
    const field = form.createRadioGroup("unicode.choice");
    options.forEach((value, index) => {
      field.addOptionToPage(value, page, { x: 30 + 40 * index, y: 200, width: 20, height: 20 });
    });
  }
  form.updateFieldAppearances(font);
  return pdf.save({ updateFieldAppearances: false });
}

it.each(["dropdown", "radio"] as const)("rejects missing glyphs in actual Unicode %s options", async (kind) => {
  const source = await unicodeChoiceFixture(kind, ["Ṱhendo Muḓau", "🌍", "漢"]);
  expect((await inspectPdfFields(source))[0].options).toEqual(["Ṱhendo Muḓau", "🌍", "漢"]);
  for (const value of ["🌍", "漢"]) {
    await expect(fillPdfFields(source, { "unicode.choice": value }, await fontFixture))
      .rejects.toThrow("UNSUPPORTED_CHARACTER");
  }
});


// C10-B boundary/unsupported-form tests are characterization, not behavioral RED.
it.each(["dropdown", "radio"] as const)("keeps supported Tshivenda %s choices exact", async (kind) => {
  const value = "  Ṱhendo Muḓau  ";
  const source = await unicodeChoiceFixture(kind, [value]);
  const output = await fillPdfFields(source, { "unicode.choice": value }, await fontFixture);
  const form = (await PDFDocument.load(output)).getForm();
  if (kind === "dropdown") expect(form.getDropdown("unicode.choice").getSelected()).toEqual([value]);
  else expect(form.getRadioGroup("unicode.choice").getSelected()).toBe(value);
});

it.each(["dropdown", "radio"] as const)("validates exact %s options before missing glyphs", async (kind) => {
  const source = await unicodeChoiceFixture(kind, ["Ṱhendo Muḓau"]);
  await expect(fillPdfFields(source, { "unicode.choice": "🌍" }, await fontFixture))
    .rejects.toThrow("INVALID_CHOICE");
});

it.each(["\r", "\n", "\t", "Ṱhendo\r\nMuḓau\t00123"])("preserves stored layout controls %j", async (value) => {
  const form = await readFilled(await contractFixture(), { name: value });
  expect(form.getTextField("name").getText()).toBe(value);
});

it("preserves maxLength precedence before glyph rejection", async () => {
  await expect(fillPdfFields(await contractFixture({ maxLength: 5 }), { name: "漢漢漢漢漢漢" }, await fontFixture))
    .rejects.toThrow("VALUE_TOO_LONG");
});

async function boundaryFixture(pages = 1, fields = 1) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index++) pdf.addPage([200, 200]);
  const form = pdf.getForm();
  for (let index = 0; index < fields; index++) form.createTextField(`field_${index}`);
  return pdf.save();
}

async function rejectBoth(source: Uint8Array, error: string) {
  await expect(inspectPdfFields(source)).rejects.toThrow(error);
  await expect(fillPdfFields(source, {}, await fontFixture)).rejects.toThrow(error);
}

it("accepts a valid PDF padded to exactly 4000000 bytes without modifying its bytes", async () => {
  const source = await boundaryFixture();
  const padded = new Uint8Array(4000000).fill(0x20);
  padded.set(source);
  const before = Buffer.from(padded);
  expect(await inspectPdfFields(padded)).toStrictEqual([
    { id: "field_0", kind: "text", required: false, initialValue: "", maxLength: undefined },
  ]);
  const output = await fillPdfFields(padded, { field_0: "Ṱhendo Muḓau" }, await fontFixture);
  expect((await PDFDocument.load(output)).getForm().getTextField("field_0").getText()).toBe("Ṱhendo Muḓau");
  expect(Buffer.compare(Buffer.from(padded), before)).toBe(0);
});

it("rejects a valid PDF padded to 4000001 bytes", async () => {
  const padded = new Uint8Array(4000001).fill(0x20);
  padded.set(await boundaryFixture());
  await rejectBoth(padded, "INVALID_PDF_SIZE");
});

it("rejects empty bytes before PDF parsing", async () => {
  await rejectBoth(new Uint8Array(), "INVALID_PDF_SIZE");
});

it("rejects incorrect PDF magic on an otherwise valid PDF", async () => {
  const source = await boundaryFixture();
  source[0] = 0x21;
  await rejectBoth(source, "INVALID_PDF");
});

it("accepts exactly 20 pages and 100 fillable fields, preserving exact IDs and page sizes", async () => {
  const source = await boundaryFixture(20, 100);
  const expected = Array.from({ length: 100 }, (_, index) => `field_${index}`);
  expect((await inspectPdfFields(source)).map((field) => field.id)).toEqual(expected);
  const output = await fillPdfFields(source, { field_99: "00123" }, await fontFixture);
  const pdf = await PDFDocument.load(output);
  expect(pdf.getPageCount()).toBe(20);
  expect(pdf.getPages().map((page) => page.getSize())).toEqual(
    Array.from({ length: 20 }, () => ({ width: 200, height: 200 })),
  );
  expect(pdf.getForm().getFields().map((field) => field.getName())).toEqual(expected);
  expect(pdf.getForm().getTextField("field_99").getText()).toBe("00123");
});

it("rejects 21 pages", async () => {
  await rejectBoth(await boundaryFixture(21), "PDF_PAGE_LIMIT");
});

it("rejects 101 fillable fields", async () => {
  await rejectBoth(await boundaryFixture(1, 101), "PDF_FIELD_LIMIT");
});

async function ignoredFieldsFixture(includeFillable: boolean) {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  const form = pdf.getForm();
  form.createButton("action.print");
  const readOnly = form.createTextField("locked.value");
  readOnly.setText("Keep exactly");
  readOnly.enableReadOnly();
  if (includeFillable) form.createTextField("answer");
  return pdf.save();
}

it("excludes buttons and read-only fields from answer targets and preserves them", async () => {
  const source = await ignoredFieldsFixture(true);
  expect((await inspectPdfFields(source)).map((field) => field.id)).toEqual(["answer"]);
  for (const id of ["action.print", "locked.value"]) {
    await expect(fillPdfFields(source, { [id]: "Do not write" }, await fontFixture))
      .rejects.toThrow("UNKNOWN_FIELD");
  }
  const pdf = await PDFDocument.load(await fillPdfFields(source, { answer: "00123" }, await fontFixture));
  expect(pdf.getForm().getFields().map((field) => field.getName())).toEqual([
    "action.print", "locked.value", "answer",
  ]);
  expect(pdf.getForm().getTextField("locked.value").getText()).toBe("Keep exactly");
  expect(pdf.getForm().getTextField("locked.value").isReadOnly()).toBe(true);
  expect(pdf.getForm().getTextField("answer").getText()).toBe("00123");
});

it.each([false, true])("rejects a form with no supported fillable fields (ignored fields: %s)", async (ignored) => {
  await rejectBoth(ignored ? await ignoredFieldsFixture(false) : await boundaryFixture(1, 0), "NO_FILLABLE_FIELDS");
});

it.each(["rich text", "editable dropdown", "multiselect dropdown", "option list"])(
  "rejects real library %s fields", async (kind) => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const form = pdf.getForm();
    if (kind === "rich text") form.createTextField("unsupported").enableRichFormatting();
    else if (kind === "option list") form.createOptionList("unsupported").addOptions(["A", "B"]);
    else {
      const dropdown = form.createDropdown("unsupported");
      dropdown.addOptions(["A", "B"]);
      if (kind === "editable dropdown") dropdown.enableEditing();
      else dropdown.enableMultiselect();
    }
    await rejectBoth(await pdf.save(), "UNSUPPORTED_FIELD_TYPE");
  },
);

it("rejects an actual signature field dictionary even when read-only", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  const signature = pdf.getForm().createTextField("signature");
  signature.enableReadOnly();
  signature.acroField.dict.set(PDFName.of("FT"), PDFName.of("Sig"));
  const source = await pdf.save();
  expect((await PDFDocument.load(source)).getForm().getFields()[0].constructor.name).toBe("PDFSignature");
  await rejectBoth(source, "SIGNATURE_REQUIRES_REVIEW");
});

async function xfaFixture() {
  const pdf = await PDFDocument.load(await boundaryFixture());
  pdf.getForm().acroForm.dict.set(PDFName.of("XFA"), pdf.context.obj("<xfa>structural fixture</xfa>"));
  return pdf.save({ updateFieldAppearances: false });
}

it("confirms real XFA data exists before pdf-lib getForm silently removes it", async () => {
  const reopened = await PDFDocument.load(await xfaFixture());
  const acroForm = reopened.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
  expect(acroForm.has(PDFName.of("XFA"))).toBe(true);
  expect(reopened.getForm().hasXFA()).toBe(false);
  expect(acroForm.has(PDFName.of("XFA"))).toBe(false);
});

it.each(["inspect", "fill"])("rejects actual XFA in %s before the library removes it", async (operation) => {
  const source = await xfaFixture();
  const before = Buffer.from(source);
  const result = operation === "inspect"
    ? inspectPdfFields(source)
    : fillPdfFields(source, {}, await fontFixture);
  await expect(result).rejects.toThrow("UNSUPPORTED_XFA");
  expect(Buffer.compare(Buffer.from(source), before)).toBe(0);
  const reopened = await PDFDocument.load(source);
  expect(reopened.catalog.lookup(PDFName.of("AcroForm"), PDFDict).has(PDFName.of("XFA"))).toBe(true);
});

it("rejects an encryption-marker fixture (structural guard evidence, not real encryption)", async () => {
  const pdf = await PDFDocument.load(await boundaryFixture());
  pdf.context.trailerInfo.Encrypt = pdf.context.register(pdf.context.obj({ Filter: "Standard" }));
  const source = await pdf.save({ useObjectStreams: false });
  expect(new TextDecoder().decode(source)).toContain("/Encrypt");
  await rejectBoth(source, "encrypted");
});
