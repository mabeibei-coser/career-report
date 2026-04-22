import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getMiniMaxClient(): OpenAI {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({
    apiKey: process.env.MINIMAX_API_KEY ?? "missing",
    baseURL: process.env.MINIMAX_BASE_URL,
  });
  return cachedClient;
}

export const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-Text-01";

// Back-compat default export using a Proxy so existing `client.chat.completions...` paths still work.
const clientProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      // @ts-expect-error dynamic delegation
      return getMiniMaxClient()[prop];
    },
  }
) as OpenAI;

export default clientProxy;
