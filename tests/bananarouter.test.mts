import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Node 24 的类型剥离测试直接加载项目 TypeScript 源文件。
import {
  callBananaRouterText,
  getBananaRouterConfig,
} from "../lib/bananarouter.ts";

const config = {
  apiKey: "test-key-not-a-secret",
  baseURL: "https://example.test",
  model: "gemini-test",
};

test("缺少 key 时不启用 BananaRouter", () => {
  assert.equal(getBananaRouterConfig({}), null);
});

test("使用 Gemini 原生 generateContent 合同并提取文本", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const text = await callBananaRouterText(
    { systemPrompt: "system", userPrompt: "user", maxTokens: 32 },
    { config, fetchImpl }
  );

  assert.equal(
    capturedUrl,
    "https://example.test/v1beta/models/gemini-test:generateContent"
  );
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer test-key-not-a-secret");
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.systemInstruction.parts[0].text, "system");
  assert.equal(body.contents[0].parts[0].text, "user");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(text, '{"ok":true}');
});

test("上游错误不泄露响应正文或 key", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response('{"error":"SECRET_SHOULD_NOT_LEAK"}', { status: 400 });

  await assert.rejects(
    callBananaRouterText(
      { systemPrompt: "system", userPrompt: "user" },
      { config, fetchImpl }
    ),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /HTTP 400/);
      assert.doesNotMatch(message, /SECRET_SHOULD_NOT_LEAK|test-key/);
      return true;
    }
  );
});

test("空候选响应会安全失败", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response('{"candidates":[]}', { status: 200 });
  await assert.rejects(
    callBananaRouterText(
      { systemPrompt: "system", userPrompt: "user" },
      { config, fetchImpl }
    ),
    /返回内容为空/
  );
});
