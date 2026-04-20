import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

// 火山引擎大模型语音合成 V3 单向流式
// 文档：https://www.volcengine.com/docs/6561/1598757
const VOLC_ENDPOINT =
  process.env.VOLC_TTS_ENDPOINT ||
  "https://openspeech.bytedance.com/api/v3/tts/unidirectional";

const audioCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 256;

function hashText(text: string, speaker: string, resourceId: string): string {
  return createHash("sha1")
    .update(`${resourceId}::${speaker}::${text}`)
    .digest("hex");
}

function storeCache(key: string, buf: Buffer) {
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
  audioCache.set(key, buf);
}

interface TTSChunk {
  code?: number;
  message?: string;
  event?: string | number;
  data?: string;
  audio?: string;
  payload_msg?: { data?: string; audio?: string };
  sequence?: number;
}

async function readStreamChunks(
  body: ReadableStream<Uint8Array>
): Promise<{
  audio: Buffer;
  error?: string;
  debug: { chunkCount: number; firstChunkPreview: string; totalBytes: number };
}> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const segments: Buffer[] = [];
  let lastError: string | undefined;
  let chunkCount = 0;
  let firstChunkPreview = "";
  let totalBytes = 0;

  const handleLine = (raw: string) => {
    let line = raw.trim();
    if (!line) return;
    if (line.startsWith("data:")) line = line.slice(5).trim();
    if (!line || line === "[DONE]") return;
    chunkCount += 1;
    if (!firstChunkPreview) firstChunkPreview = line.slice(0, 200);
    let parsed: TTSChunk;
    try {
      parsed = JSON.parse(line);
    } catch (e) {
      lastError = `JSON parse failed: ${(e as Error).message}`;
      return;
    }
    if (
      typeof parsed.code === "number" &&
      parsed.code !== 0 &&
      parsed.code !== 3000 &&
      parsed.code !== 20000000
    ) {
      lastError = `code=${parsed.code} ${parsed.message ?? ""}`;
      return;
    }
    const b64 =
      parsed.data ||
      parsed.audio ||
      parsed.payload_msg?.data ||
      parsed.payload_msg?.audio;
    if (b64) {
      try {
        segments.push(Buffer.from(b64, "base64"));
      } catch {
        /* ignore bad segment */
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    buffer += decoder.decode(value, { stream: true });
    let newlineIdx = buffer.indexOf("\n");
    while (newlineIdx !== -1) {
      handleLine(buffer.slice(0, newlineIdx));
      buffer = buffer.slice(newlineIdx + 1);
      newlineIdx = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) handleLine(buffer);

  return {
    audio: Buffer.concat(segments),
    error: lastError,
    debug: { chunkCount, firstChunkPreview, totalBytes },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body?.text as string | undefined)?.trim();
    if (!text) {
      return NextResponse.json({ error: "text 不能为空" }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json(
        { error: "单次合成文本过长（上限 1000 字）" },
        { status: 413 }
      );
    }

    const appKey = process.env.VOLC_TTS_APP_KEY?.trim();
    const accessKey = process.env.VOLC_TTS_ACCESS_KEY?.trim();
    const speaker = process.env.VOLC_TTS_SPEAKER?.trim();
    const resourceId =
      process.env.VOLC_TTS_RESOURCE_ID?.trim() || "seed-tts-2.0";

    if (!appKey || !accessKey || !speaker) {
      return NextResponse.json(
        {
          error:
            "TTS 尚未配置（缺少 VOLC_TTS_APP_KEY / VOLC_TTS_ACCESS_KEY / VOLC_TTS_SPEAKER）",
        },
        { status: 503 }
      );
    }

    const cacheKey = hashText(text, speaker, resourceId);
    const cached = audioCache.get(cacheKey);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=604800",
          "X-Cache": "HIT",
        },
      });
    }

    const requestId = randomUUID();
    const payload = {
      user: { uid: "career-report-anon" },
      req_params: {
        text,
        speaker,
        audio_params: {
          format: "mp3",
          sample_rate: 24000,
        },
        additions: "{}",
      },
    };

    const res = await fetch(VOLC_ENDPOINT, {
      method: "POST",
      headers: {
        "X-Api-App-Key": appKey,
        "X-Api-Access-Key": accessKey,
        "X-Api-Resource-Id": resourceId,
        "X-Api-Request-Id": requestId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const headerStatus = res.headers.get("X-Api-Status-Code") ?? "";
    const headerMessage = res.headers.get("X-Api-Message") ?? "";

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `火山 TTS HTTP ${res.status} ${headerStatus} ${headerMessage}`.trim(),
          detail: errText.slice(0, 500),
        },
        { status: 503 }
      );
    }

    if (headerStatus && headerStatus !== "20000000" && headerStatus !== "0") {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `火山 TTS 状态异常：${headerStatus} ${headerMessage}`,
          detail: errText.slice(0, 500),
        },
        { status: 503 }
      );
    }

    const { audio, error, debug } = await readStreamChunks(res.body);

    if (error || audio.byteLength === 0) {
      console.warn("[TTS] empty audio", {
        payloadSent: JSON.stringify(payload).slice(0, 200),
        debug,
        error,
      });
      return NextResponse.json(
        {
          error: `火山 TTS 合成失败：${error ?? "未收到音频数据"}`,
          debug,
        },
        { status: 503 }
      );
    }

    storeCache(cacheKey, audio);

    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=604800",
        "X-Cache": "MISS",
      },
    });
  } catch (error: unknown) {
    console.error("TTS API error:", error);
    const message = error instanceof Error ? error.message : "TTS 合成失败";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
