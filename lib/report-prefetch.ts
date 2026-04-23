/**
 * Report 章节预拉取单例
 * ———————————————
 * /quiz 页提交（或更早时机）时调 startReportPrefetch(formData)，把 4 个不依赖测评
 * 画像的前置章节（salary / resumeDiagnosis / salaryNegotiation / workplaceInsight）
 * 的 fetch Promise 存在模块内；/loading 或 /report 页 mount 时调
 * consumeReportPrefetch() 取出。
 *
 * 为什么不传 quizAnswers：
 *   这 4 个章节的 buildBaseContext 不需要性格画像（画像主要服务 overview /
 *   positionInfo），API 侧在 quizAnswers 未传时会跳过性格段，不影响内容质量。
 *   这样就能在用户答题的 20-60s 里把这 4 个 MiniMax 请求并行消化掉。
 *
 * 仅在浏览器 SPA 生命周期内有效；刷新 / 硬跳转会丢失（消费方返回 null，降级到
 * 现场 fetch via report-client 的 callSection）。
 */

import type { JobFormData } from "@/lib/types";

const PREFETCH_SECTIONS = [
  { key: "salary", endpoint: "/api/report/salary" },
  { key: "resumeDiagnosis", endpoint: "/api/report/resume-diagnosis" },
  { key: "salaryNegotiation", endpoint: "/api/report/negotiation" },
  { key: "workplaceInsight", endpoint: "/api/report/workplace-insight" },
] as const;

export type PrefetchSectionKey = (typeof PREFETCH_SECTIONS)[number]["key"];

interface PrefetchState {
  key: string;
  promises: Map<PrefetchSectionKey, Promise<unknown>>;
  controllers: Map<PrefetchSectionKey, AbortController>;
  startedAt: number;
}

let pending: PrefetchState | null = null;

function fingerprint(formData: JobFormData): string {
  // 与 quiz-prefetch.ts 保持一致的 key：意向岗位 + 学历 + 公司 + 城市能级 + 简历前 50 字
  const resumeHash = formData.resumeText?.slice(0, 50) ?? "";
  return [
    formData.targetPosition,
    formData.targetEducation,
    formData.targetCompany,
    formData.targetCityTier,
    resumeHash,
  ].join("|");
}

function fetchSection(
  endpoint: string,
  formData: JobFormData,
  signal: AbortSignal
): Promise<unknown> {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formData }),
    signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const err = new Error(j.error || `HTTP ${res.status}`);
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      const json = (await res.json()) as { data?: unknown };
      return json.data;
    })
    .catch((e: unknown) => {
      throw e instanceof Error ? e : new Error("章节预拉取失败");
    });
}

export function startReportPrefetch(formData: JobFormData): void {
  if (typeof window === "undefined") return;
  const key = fingerprint(formData);
  // 已有相同指纹的 pending：保留，不重复启动
  if (pending && pending.key === key) return;
  // 指纹不同：先清理旧的 4 个（abort），再启动新的
  clearReportPrefetch();

  const promises = new Map<PrefetchSectionKey, Promise<unknown>>();
  const controllers = new Map<PrefetchSectionKey, AbortController>();

  for (const section of PREFETCH_SECTIONS) {
    const controller = new AbortController();
    controllers.set(section.key, controller);
    const promise = fetchSection(section.endpoint, formData, controller.signal);
    // 挂一个 no-op 兜底，防止 Promise unhandled rejection warning；
    // 真正的错误仍会在消费方 await 时被看到
    promise.catch(() => {});
    promises.set(section.key, promise);
  }

  pending = {
    key,
    promises,
    controllers,
    startedAt: Date.now(),
  };
}

export function consumeReportPrefetch(
  formData: JobFormData
): Map<PrefetchSectionKey, Promise<unknown>> | null {
  if (typeof window === "undefined") return null;
  if (!pending) return null;
  if (pending.key !== fingerprint(formData)) {
    // 指纹不匹配（用户改了表单又跳回来）：丢弃并 abort
    clearReportPrefetch();
    return null;
  }
  const out = pending.promises;
  // 一次性消费：只清引用，不 abort（Promise 还要被消费方 await）
  pending = null;
  return out;
}

export function clearReportPrefetch(): void {
  if (!pending) return;
  for (const controller of pending.controllers.values()) {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }
  pending = null;
}
