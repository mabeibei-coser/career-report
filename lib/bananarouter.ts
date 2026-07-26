const DEFAULT_BASE_URL = "https://api.bananarouter.com";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export interface BananaRouterConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface BananaRouterTextOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

interface BananaRouterDependencies {
  config?: BananaRouterConfig;
  fetchImpl?: typeof fetch;
}

export function getBananaRouterConfig(
  env: NodeJS.ProcessEnv = process.env
): BananaRouterConfig | null {
  const apiKey = env.BANANAROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL: (env.BANANAROUTER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: env.BANANAROUTER_MODEL ?? DEFAULT_MODEL,
  };
}

export const hasBananaRouter = getBananaRouterConfig() !== null;

function extractCandidateText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return "";
  const texts: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object") continue;
    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") texts.push(text);
    }
  }
  return texts.join("\n").trim();
}

export async function callBananaRouterText(
  opts: BananaRouterTextOptions,
  dependencies: BananaRouterDependencies = {}
): Promise<string> {
  const config = dependencies.config ?? getBananaRouterConfig();
  if (!config) throw new Error("BananaRouter 未配置");

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 50_000);
  const endpoint = `${config.baseURL}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [{ text: opts.userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: opts.temperature ?? 0.6,
          maxOutputTokens: opts.maxTokens ?? 3000,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`BananaRouter 请求失败（HTTP ${response.status}）`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("BananaRouter 返回了无效 JSON");
    }
    const content = extractCandidateText(payload);
    if (!content) throw new Error("BananaRouter 返回内容为空");
    return content;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("BananaRouter 请求超时");
    }
    if (error instanceof Error && error.message.startsWith("BananaRouter")) {
      throw error;
    }
    throw new Error("BananaRouter 请求失败");
  } finally {
    clearTimeout(timer);
  }
}
