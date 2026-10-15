import { NextResponse } from "next/server";
import { LANGUAGE_CAPABILITIES } from "@/lib/speech/capabilities";

/** Public voice-support matrix. Product labels only. */
export async function GET() {
  return NextResponse.json(
    { languages: LANGUAGE_CAPABILITIES },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
