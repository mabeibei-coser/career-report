/**
 * Report 章节后台 runner（quiz 完成阶段）
 * ———————————————
 * /quiz 第 6 题选完点"进入 AI 访谈"瞬间调 startBgSections(formData, quizAnswers)，
 * 启动剩余 2 个依赖测评画像的章节（overview / positionInfo）的 fetch；
 * /loading → generateReport 内部调 consumeBgSections 取出 promise 复用。
 *
 * 与 lib/report-prefetch.ts 是互补关系：
 *   - prefetch：form 提交时启动 4 个不依赖 quizAnswers 的章节
 *   - bg-runner：quiz 完成时启动剩余 2 个依赖 quizAnswers 的章节
 *   - 两路并行，generateReport 在 loading 页一次性消费 6 个 promise
 *
 * 为什么不传 interviewSummary：
 *   设计上把"等访谈完才能跑"的依赖关系切掉 —— 用户走完 3-5 分钟语音访谈时，
 *   报告的 6 个章节大概率已全部跑完。访谈对话原本只是 prompt 末尾拼接的画像
 *   素材（200-400 字 raw Q&A），权重远低于 quizAnswers 的结构化标签。
 *
 * 仅在浏览器 SPA 生命周期内有效；刷新 / 硬跳转会丢失（消费方返回 null，降级到
 * 现场 fetch via report-client 的 callSection）。
 */

import type { JobFormData, QuizAnswer } from "@/lib/types";

const BG_SECTIONS = [
  { key: "overview", endpoint: "/api/report/overview" },
  { key: "positionInfo", endpoint: "/api/report/position-info" },
] as const;

export type BgSectionKey = (typeof BG_SECTIONS)[number]["key"];

interface BgState {
  key: string;
  promises: Map<BgSectionKey, Promise<unknown>>;
  controllers: Map<BgSectionKey, AbortController>;
  startedAt: number;
}

let pending: BgState | null = null;

function fingerprint(formData: JobFormData, quizAnswers: QuizAnswer[]): string {
  // 基础部分与 prefetch.fingerprint 对齐（保持 key 风格一致）
  const resumeHash = formData.resumeText?.slice(0, 50) ?? "";
  const formPart = [
    formData.targetPosition,
    formData.targetEducation,
    formData.targetCompany,
    formData.targetCityTier,
    resumeHash,
  ].join("|");
  // 再附加 quizAnswers 的 dimension+selectedKey 串联：用户改答案重提交时触发重启
  const quizPart = quizAnswers
    .map((a) => `${a.dimension}:${a.selectedKey}`)
    .join(",");
  return `${formPart}#${quizPart}`;
}

function fetchSection(
  endpoint: string,
  formData: JobFormData,
  quizAnswers: QuizAnswer[],
  signal: AbortSignal
): Promise<unknown> {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 不传 interviewSummary —— 见文件头注释
    body: JSON.stringify({ formData, quizAnswers }),
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
      throw e instanceof Error ? e : new Error("章节后台预拉取失败");
    });
}

export function startBgSections(
  formData: JobFormData,
  quizAnswers: QuizAnswer[]
): void {
  if (typeof window === "undefined") return;
  const key = fingerprint(formData, quizAnswers);
  // 已有相同指纹的 pending：保留，不重复启动（重入幂等）
  if (pending && pending.key === key) {
    console.info("[bg-runner] start", { key: key.slice(0, 40), hit: true });
    return;
  }
  // 指纹不同：先清理旧的（abort），再启动新的
  clearBgSections();

  const promises = new Map<BgSectionKey, Promise<unknown>>();
  const controllers = new Map<BgSectionKey, AbortController>();

  for (const section of BG_SECTIONS) {
    const controller = new AbortController();
    controllers.set(section.key, controller);
    const promise = fetchSection(
      section.endpoint,
      formData,
      quizAnswers,
      controller.signal
    );
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
  console.info("[bg-runner] start", {
    key: key.slice(0, 40),
    hit: false,
    sections: BG_SECTIONS.map((s) => s.key),
  });
}

export function consumeBgSections(
  formData: JobFormData,
  quizAnswers: QuizAnswer[]
): Map<BgSectionKey, Promise<unknown>> | null {
  if (typeof window === "undefined") return null;
  if (!pending) {
    console.info("[bg-runner] consume", { hit: false, count: 0 });
    return null;
  }
  if (pending.key !== fingerprint(formData, quizAnswers)) {
    // 指纹不匹配（用户改了表单或答案又跳回来）：丢弃并 abort
    console.info("[bg-runner] consume", {
      hit: false,
      reason: "fingerprint mismatch",
    });
    clearBgSections();
    return null;
  }
  const out = pending.promises;
  console.info("[bg-runner] consume", { hit: true, count: out.size });
  // 一次性消费：只清引用，不 abort（Promise 还要被消费方 await）
  pending = null;
  return out;
}

export function clearBgSections(): void {
  if (!pending) return;
  console.warn("[bg-runner] abort", {
    key: pending.key.slice(0, 40),
    elapsed: Date.now() - pending.startedAt,
  });
  for (const controller of pending.controllers.values()) {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }
  pending = null;
}
