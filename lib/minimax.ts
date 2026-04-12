import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL,
});

export const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M1";

// TTS base URL — derive from MINIMAX_BASE_URL to use the same domain
function getTtsBaseUrl(): string {
  if (process.env.MINIMAX_TTS_BASE_URL) return process.env.MINIMAX_TTS_BASE_URL;
  const base = process.env.MINIMAX_BASE_URL || "";
  if (base.includes("minimaxi.chat")) return "https://api.minimaxi.chat/v1";
  if (base.includes("minimax.chat")) return "https://api.minimax.chat/v1";
  return "https://api.minimax.io/v1";
}
const TTS_BASE_URL = getTtsBaseUrl();

export async function textToSpeech(text: string): Promise<Buffer> {
  const res = await fetch(`${TTS_BASE_URL}/t2a_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: "speech-02-turbo",
      text,
      stream: false,
      voice_setting: {
        voice_id: "Chinese_Gentle_Female",
        speed: 1,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        format: "mp3",
        sample_rate: 32000,
        bitrate: 128000,
        channel: 1,
      },
      output_format: "hex",
    }),
  });

  if (!res.ok) {
    throw new Error(`TTS API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`TTS error: ${json.base_resp?.status_msg || "unknown"}`);
  }

  return Buffer.from(json.data.audio, "hex");
}

export default client;
