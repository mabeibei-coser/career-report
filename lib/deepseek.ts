import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getDeepSeekClient(): OpenAI {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? "missing",
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  });
  return cachedClient;
}

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// Back-compat default export using a Proxy so existing `client.chat.completions...` paths still work.
const clientProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      // @ts-expect-error dynamic delegation
      return getDeepSeekClient()[prop];
    },
  }
) as OpenAI;

export default clientProxy;
