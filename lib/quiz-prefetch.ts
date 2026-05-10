/**
 * Quiz 预拉取单例
 * —————————————
 * 表单提交时调 startQuizPrefetch(formData)，把 /api/quiz/generate 的 fetch Promise
 * 存在模块内；/quiz 页面 mount 时调 consumeQuizPrefetch() 取出并清空。
 *
 * 场景：用户点"开始 6 题快测"后，需要 10-30s 等 DeepSeek 生成题目。把 fetch 提前
 * 到表单页提交那一刻启动，Next 客户端路由跳转 + React mount 时间（约 0.5-1.5s）
 * 就可以并行消化掉。
 *
 * 仅在浏览器 SPA 生命周期内有效；刷新 / 硬跳转会丢失（降级回 quiz 页现场 fetch）。
 */

import type { JobFormData, QuizQuestion } from "@/lib/types";

type QuizResponse = { questions: QuizQuestion[]; error?: string };

interface PrefetchEntry {
  key: string;
  promise: Promise<QuizResponse>;
  startedAt: number;
}

let pending: PrefetchEntry | null = null;

function fingerprint(formData: JobFormData): string {
  // 简单 key：意向岗位 + 学历 + 公司 + 城市能级 + 简历前 50 字
  const resumeHash = formData.resumeText?.slice(0, 50) ?? "";
  return [
    formData.targetPosition,
    formData.targetEducation,
    formData.targetCompany,
    formData.targetCityTier,
    resumeHash,
  ].join("|");
}

export function startQuizPrefetch(formData: JobFormData): void {
  if (typeof window === "undefined") return;
  const key = fingerprint(formData);
  // 已有相同指纹的 pending：保留
  if (pending && pending.key === key) return;
  const promise = fetch("/api/quiz/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formData, from: 3 }),
  })
    .then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as QuizResponse;
      if (!res.ok || !data.questions) {
        throw new Error(data.error ?? `测评题获取失败（HTTP ${res.status}）`);
      }
      return data;
    })
    .catch((e: unknown) => {
      // 保留 promise 并向下游传递错误（调用方会看到 reject）
      throw e instanceof Error ? e : new Error("测评题获取失败");
    });
  pending = { key, promise, startedAt: Date.now() };
}

export function consumeQuizPrefetch(
  formData: JobFormData
): { promise: Promise<QuizResponse>; age: number } | null {
  if (typeof window === "undefined") return null;
  if (!pending) return null;
  if (pending.key !== fingerprint(formData)) {
    // 指纹不匹配（用户改了表单又跳回来），丢弃
    pending = null;
    return null;
  }
  const out = { promise: pending.promise, age: Date.now() - pending.startedAt };
  pending = null;
  return out;
}
