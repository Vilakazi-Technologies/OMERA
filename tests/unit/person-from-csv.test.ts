import { describe, expect, it } from "vitest";
import { extractPersonFromCsv, prefillForLabel } from "@/lib/csv/person-from-csv";

const ONE = [
  "Full name,ID number,Phone,Email,Address,Employer,CSD number,Tax reference",
  'Andile Mushwana,8001015009087,0825550101,andile@example.com,"12 Main Rd, Pretoria",Enternovate,MAAA0123456,9012345678',
].join("\n");

describe("extractPersonFromCsv", () => {
  it("reads identity and SA tender columns from a header row", () => {
    const person = extractPersonFromCsv(ONE);
    expect(person.values.fullName).toBe("Andile Mushwana");
    expect(person.values.idNumber).toBe("8001015009087");
    expect(person.values.address).toBe("12 Main Rd, Pretoria");
    expect(person.values.employer).toBe("Enternovate");
    expect(person.values.csd).toBe("MAAA0123456");
    expect(person.values.tax).toBe("9012345678");
    expect(person.sourceRow).toBe(2);
    expect(person.note).toBe("Using row 2.");
  });

  it("accepts semicolons and joins first name with surname", () => {
    const person = extractPersonFromCsv(
      ["First name;Surname;Cell;E-mail;Company name", "Ayanda;Vilakazi;0710000000;ayanda@vilatech.co.za;VILATECH"].join("\n"),
    );
    expect(person.values.fullName).toBe("Ayanda Vilakazi");
    expect(person.values.phone).toBe("0710000000");
    expect(person.values.email).toBe("ayanda@vilatech.co.za");
    expect(person.values.employer).toBe("VILATECH");
  });

  it("uses the first complete person when several rows are present", () => {
    const person = extractPersonFromCsv(
      ["Name,Phone,Email", "Incomplete Only,,", "Nomsa Dlamini,0831112222,nomsa@example.com", "Second Person,0840000000,second@example.com"].join("\n"),
    );
    expect(person.values.fullName).toBe("Nomsa Dlamini");
    expect(person.sourceRow).toBe(3);
    expect(person.note).toMatch(/first complete person/);
  });

  it("falls back to the first identity row when none are complete", () => {
    const person = extractPersonFromCsv("Name\nThabo Mokoena\nLerato Nkosi");
    expect(person.values.fullName).toBe("Thabo Mokoena");
    expect(person.note).toMatch(/first person row/);
  });

  it("rejects a file with no person", () => {
    expect(() => extractPersonFromCsv("Product,Qty\nWidgets,2")).toThrow("NO_PERSON_ROW");
  });
});

describe("prefillForLabel", () => {
  const person = extractPersonFromCsv(ONE);
  it("matches question labels and leaves signatures blank", () => {
    expect(prefillForLabel(person, "Full name")).toBe("Andile Mushwana");
    expect(prefillForLabel(person, "ID number")).toBe("8001015009087");
    expect(prefillForLabel(person, "Cell number")).toBe("0825550101");
    expect(prefillForLabel(person, "Physical address")).toBe("12 Main Rd, Pretoria");
    expect(prefillForLabel(person, "Company name")).toBe("Enternovate");
    expect(prefillForLabel(person, "CSD number")).toBe("MAAA0123456");
    expect(prefillForLabel(person, "Tax reference")).toBe("9012345678");
    expect(prefillForLabel(person, "Signature")).toBeUndefined();
  });
});
