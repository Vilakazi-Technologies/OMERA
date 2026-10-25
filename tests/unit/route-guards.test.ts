import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = join(process.cwd(), "src", "app", "api");
const MUTATING = /export async function (POST|PUT|PATCH|DELETE)\b/;
const GATEWAY_ALLOWLIST = [
  "src/app/api/store/complete-json/route.ts",
  "src/app/api/store/complete-vision-json/route.ts",
];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

describe("route guards", () => {
  it("every mutating route checks the request origin", () => {
    const missing = routeFiles(API_ROOT)
      .map((file) => relative(process.cwd(), file).replace(/\\/g, "/"))
      .filter((file) => !GATEWAY_ALLOWLIST.includes(file))
      .filter((file) => MUTATING.test(readFileSync(join(process.cwd(), file), "utf8")))
      .filter(
        (file) =>
          !readFileSync(join(process.cwd(), file), "utf8").includes(
            "requireRequestOrigin",
          ),
      );
    expect(missing).toEqual([]);
  });
});
