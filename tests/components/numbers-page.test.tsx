// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import NumbersPage from "@/app/(platform)/numbers/page";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../fixtures/results-sample.csv"),
  "utf8",
);

afterEach(() => {
  cleanup();
});

describe("numbers page", () => {
  it("turns an uploaded results csv into manager steps", async () => {
    render(<NumbersPage />);
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("missing file input");
    const file = new File([fixture], "results-sample.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => fixture });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole("heading", { name: /net profit is down/i })).toBeInTheDocument();
    expect(screen.getByText(/gross margin is thin/i)).toBeInTheDocument();
    expect(screen.getByText(/fell from/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole("listitem").length).toBeLessThanOrEqual(5);
  });
});
