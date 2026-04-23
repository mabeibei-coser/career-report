import type {
  JobFormData,
  NegotiationTips,
  Overview,
  PositionInfo,
  QuizAnswer,
  ReportData,
  ReportSectionKey,
  ResumeDiagnosis,
  SalaryInsight,
  WorkplaceInsight,
} from "@/lib/types";
import {
  negotiationMock,
  overviewMock,
  positionInfoMock,
  resumeDiagnosisMock,
  salaryMock,
  workplaceInsightMock,
} from "@/lib/mocks/report-mocks";

const SECTION_CONFIG: {
  key: ReportSectionKey;
  endpoint: string;
  label: string;
  fallback: unknown;
  dataSource?: string;
}[] = [
  { key: "overview", endpoint: "/api/report/overview", label: "绘制定位总览", fallback: overviewMock, dataSource: "谨世 ATA L2" },
  { key: "salary", endpoint: "/api/report/salary", label: "匹配岗位薪资区间", fallback: salaryMock, dataSource: "谨世薪酬 L2 数据库" },
  { key: "positionInfo", endpoint: "/api/report/position-info", label: "拆解细分岗位分析", fallback: positionInfoMock, dataSource: "谨世 ATA L2" },
  { key: "resumeDiagnosis", endpoint: "/api/report/resume-diagnosis", label: "诊断简历改进点", fallback: resumeDiagnosisMock, dataSource: "谨世 ATA L2" },
  { key: "salaryNegotiation", endpoint: "/api/report/negotiation", label: "梳理谈薪要点", fallback: negotiationMock, dataSource: "谨世 ATA L2" },
  { key: "workplaceInsight", endpoint: "/api/report/workplace-insight", label: "绘制职场环境透视", fallback: workplaceInsightMock, dataSource: "谨世岗职大数据库" },
];

export type SectionStatus = "pending" | "loading" | "completed" | "fallback" | "skipped";

export interface SectionProgress {
  key: ReportSectionKey;
  label: string;
  status: SectionStatus;
  error?: string;
  dataSource?: string;
}

export interface GenerateReportOptions {
  onProgress?: (progress: SectionProgress[]) => void;
  useMockOnly?: boolean;
  retries?: number;
}

async function callSection<T>(
  endpoint: string,
  formData: JobFormData,
  quizAnswers: QuizAnswer[]
): Promise<{ data: T | null }> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formData, quizAnswers }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const err = new Error(j.error || `HTTP ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

function isRateLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number } | null)?.status;
  if (status === 429 || status === 529) return true;
  return /\b(429|529)\b|Token Plan|拥挤|rate.?limit|too many requests/i.test(msg);
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// 限并发 + 遇 429/529 退避重试
async function runWithConcurrency<T>(
  items: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await items[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function generateReport(
  formData: JobFormData,
  quizAnswers: QuizAnswer[],
  options: GenerateReportOptions = {}
): Promise<ReportData> {
  const progress: SectionProgress[] = SECTION_CONFIG.map((s) => ({
    key: s.key,
    label: s.label,
    status: "pending",
    dataSource: s.dataSource,
  }));

  const update = () => options.onProgress?.([...progress]);
  update();

  const retries = options.retries ?? 1; // 1 次重试（加初始尝试共 2 次）：M2.7 不稳时让失败章节 fallback 到 mock，报告立刻出来，而不是让用户等 2+ 分钟重试

  const tasks = SECTION_CONFIG.map((section, idx) => async () => {
    if (
      section.key === "resumeDiagnosis" &&
      (!formData.resumeText || formData.resumeText.length < 50)
    ) {
      progress[idx].status = "skipped";
      update();
      return { key: section.key, data: null };
    }

    progress[idx].status = "loading";
    update();

    let attempts = 0;
    let lastError: unknown;
    while (attempts <= retries) {
      try {
        if (options.useMockOnly) throw new Error("forced mock");
        const res = await callSection(section.endpoint, formData, quizAnswers);
        progress[idx].status = "completed";
        update();
        return { key: section.key, data: res.data };
      } catch (e) {
        lastError = e;
        attempts++;
        if (attempts > retries) break;
        // 指数退避。6 路并发时限流类错误用大 jitter，让重试错开时间窗口
        const isRL = isRateLimitError(e);
        const baseMs = isRL ? 2500 : 600;
        const jitter = Math.random() * (isRL ? 1800 : 400);
        const backoff = baseMs * Math.pow(1.8, attempts - 1) + jitter;
        await wait(Math.min(backoff, 12000));
      }
    }
    console.warn(`[report] ${section.key} failed, using mock:`, lastError);
    progress[idx].status = "fallback";
    progress[idx].error =
      lastError instanceof Error ? lastError.message : String(lastError);
    update();
    return { key: section.key, data: section.fallback };
  });

  // 6 章节全并发：每章节一个 MiniMax 请求同时发出
  // 若额度不够会出 429/529，由内层指数退避 + 最多 3 次重试兜底；
  // 真·最坏情况个别章节用 mock 兜底，不会整个报告失败
  const results = await runWithConcurrency(tasks, 6);
  const map = new Map<ReportSectionKey, unknown>();
  for (const r of results) map.set(r.key, r.data);

  const quizSummary =
    quizAnswers && quizAnswers.length > 0
      ? `完成 ${quizAnswers.length} 题职业性格快测`
      : "未完成职业测评";

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      formData,
      quizSummary,
      hasResume: Boolean(formData.resumeText && formData.resumeText.length > 50),
    },
    overview: map.get("overview") as Overview,
    salary: map.get("salary") as SalaryInsight,
    positionInfo: map.get("positionInfo") as PositionInfo,
    resumeDiagnosis: map.get("resumeDiagnosis") as ResumeDiagnosis | null,
    salaryNegotiation: map.get("salaryNegotiation") as NegotiationTips,
    workplaceInsight: map.get("workplaceInsight") as WorkplaceInsight,
  };
}

export { SECTION_CONFIG };
