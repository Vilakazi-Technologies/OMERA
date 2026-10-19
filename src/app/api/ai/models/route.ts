import { NextResponse } from "next/server";
import { buildModelCatalog } from "@/lib/ai/model-catalog";

export async function GET() {
  const catalog = buildModelCatalog();
  return NextResponse.json(catalog, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
