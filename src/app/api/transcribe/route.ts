import { NextResponse } from "next/server";
import { getLanguage } from "@/lib/languages";
import { transcribeAudio, translateToEnglish } from "@/lib/lelapa";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      audioBase64: string;
      mimeType?: string;
      languageId: string;
    };

    if (!body.audioBase64) {
      return NextResponse.json(
        { error: "Missing audio" },
        { status: 400 },
      );
    }

    const lang = getLanguage(body.languageId);
    const result = await transcribeAudio(
      body.audioBase64,
      lang.id,
      body.mimeType ?? "audio/webm",
    );

    let text = result.text;
    if (lang.lelapaTranslate && lang.id !== "eng") {
      text = await translateToEnglish(text, lang.lelapaTranslate);
    }

    return NextResponse.json({
      text,
      provider: result.provider,
      languageId: lang.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
