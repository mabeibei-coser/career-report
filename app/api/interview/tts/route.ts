import { NextRequest, NextResponse } from "next/server";
import { textToSpeech } from "@/lib/minimax";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "缺少文本内容" }, { status: 400 });
    }

    // Limit text length for TTS
    const truncated = text.slice(0, 2000);

    const audioBuffer = await textToSpeech(truncated);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "语音合成失败" },
      { status: 500 }
    );
  }
}
