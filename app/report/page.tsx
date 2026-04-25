"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ReportRenderContext } from "@/components/report/report-context";
import { OverviewSection } from "@/components/report/overview-section";
import { SalarySection } from "@/components/report/salary-section";
import { PositionInfoSection } from "@/components/report/position-info-section";
import { ResumeDiagnosisSection } from "@/components/report/resume-diagnosis-section";
import { NegotiationSection } from "@/components/report/negotiation-section";
import { WorkplaceInsightSection } from "@/components/report/workplace-insight-section";
import { DownloadPDFButton } from "@/components/report/download-pdf-button";
import type { ReportData } from "@/lib/types";

// 客户端错误上报到服务端日志（失败无副作用）
function clientLog(event: string, data?: unknown) {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/_client_log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        url: window.location.href,
        ua: navigator.userAgent,
        time: new Date().toISOString(),
        data,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 忽略 */
  }
}

// React 错误边界：包住某个 section，内部 throw 时显示错误提示而不是白屏
class SectionErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { err: Error | null }
> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error, info: { componentStack?: string }) {
    clientLog("section-error", {
      name: this.props.name,
      message: err.message,
      stack: err.stack?.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 500),
    });
  }
  render() {
    if (this.state.err) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800 break-inside-avoid">
          <div className="font-semibold mb-1">
            本章节（{this.props.name}）加载时出错，已跳过
          </div>
          <div className="text-amber-700 text-[11px] font-mono">
            {this.state.err.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function loadReportFromSession(): ReportData | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem("reportData");
  if (!stored) return null;
  try {
    const data = JSON.parse(stored) as ReportData;
    // 最低要求：meta + targetPosition（决定页面要不要渲染；其他字段缺失
    // 由具体 section 组件自己兜底）
    if (!data?.meta?.formData?.targetPosition) {
      console.warn("[report-page] missing meta.formData.targetPosition, data=", data);
      return null;
    }
    // 详细 schema 检查仅 warning 不拦截——哪怕部分字段缺失，至少让用户看到
    // 生成出来的内容，section 组件层面自己兜底空值
    const missing: string[] = [];
    if (!data.overview?.strength?.title) missing.push("overview.strength.title");
    if (!data.overview?.improvement?.title) missing.push("overview.improvement.title");
    if (!data.overview?.personality?.type) missing.push("overview.personality.type");
    if (!data.salaryNegotiation?.aiExperience) missing.push("salaryNegotiation.aiExperience");
    if (!data.workplaceInsight?.companyInsight?.developmentSummary) missing.push("workplaceInsight.companyInsight.developmentSummary");
    if (!data.positionInfo?.subPositions?.[0]?.fitReason) missing.push("positionInfo.subPositions[0].fitReason");
    if (missing.length > 0) {
      console.warn("[report-page] some schema fields missing (still rendering):", missing);
    }
    return data;
  } catch (e) {
    console.error("[report-page] JSON.parse failed:", e);
    return null;
  }
}

export default function ReportPage() {
  const router = useRouter();
  // useState 初始化器在 SSR hydration 边界上不稳定（特别是 Puppeteer 渲染场景），
  // 改用 useEffect 懒加载 sessionStorage
  const [report, setReport] = useState<ReportData | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 检测 ?pdf=1：Puppeteer 服务端渲染时加这个 flag
  const [isPdfMode, setIsPdfMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    clientLog("report-mount", {
      hasSessionData: !!sessionStorage.getItem("reportData"),
      sessionDataLen: sessionStorage.getItem("reportData")?.length || 0,
    });
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sp.get("pdf") === "1") setIsPdfMode(true);
    const r = loadReportFromSession();
    clientLog("report-loaded", {
      hasReport: !!r,
      targetPosition: r?.meta?.formData?.targetPosition,
    });
    setReport(r);
    setLoaded(true);

    // 全局错误捕获
    const onError = (e: ErrorEvent) => {
      clientLog("window-error", {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        col: e.colno,
      });
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  // 不再自动 router.replace("/form")——之前静默跳转让用户看到"This page couldn't load"
  // 很困惑。改为显示明确的错误提示 + 返回按钮

  const ctxValue = useMemo(() => ({ exporting: isPdfMode }), [isPdfMode]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--blue-50)]/60 to-white">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--blue-500)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--blue-50)]/60 to-white px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <div className="text-lg font-semibold text-[var(--navy-900)]">报告数据丢失</div>
          <div className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            会话中没找到报告数据（可能是刷新了页面或换了浏览器打开）。请重新填写信息生成报告。
          </div>
          <button
            type="button"
            onClick={() => router.push("/form")}
            className="h-10 px-6 bg-[var(--blue-500)] hover:bg-[var(--blue-600)] text-white font-medium rounded-lg"
          >
            返回填写信息
          </button>
        </div>
      </div>
    );
  }

  const formDate = new Date(report.meta.generatedAt);
  const dateLabel = formDate.toLocaleDateString("zh-CN");
  const position = report.meta.formData.targetPosition;

  const hasResume = Boolean(report.resumeDiagnosis);
  const total = hasResume ? 6 : 5;

  return (
    <ReportRenderContext.Provider value={ctxValue}>
      <div className="report-shell pb-10 print:pb-0 print:bg-white">
        {/* Header — aligned with form page masthead */}
        <div
          data-pdf-section="header"
          className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 sm:pt-10 pb-6 print:pt-0"
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge
              variant="secondary"
              className="bg-[var(--blue-500)] text-white text-xs"
            >
              校招定位报告
            </Badge>
            <Badge variant="secondary" className="bg-white text-xs">
              {position} · {report.meta.formData.targetEducation}
            </Badge>
            <Badge variant="secondary" className="bg-white text-xs">
              {report.meta.formData.targetCityTier}
            </Badge>
            <Badge variant="secondary" className="bg-white text-xs">
              意向：{report.meta.formData.targetCompany}
            </Badge>
            {report.meta.hasResume && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 text-xs"
              >
                已结合简历
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--navy-950)] tracking-tight mb-2">
            {position} · 校招定位报告
          </h1>
          <p className="text-xs sm:text-sm text-[var(--report-ink-muted)]">
            生成于 {dateLabel} · 共 {total} 章节
          </p>
        </div>

        {/* Sections — 每个 section 用 ErrorBoundary 包，单个 crash 不拖垮整页 */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-4 sm:space-y-5">
          <SectionErrorBoundary name="定位总览">
            <OverviewSection data={report.overview} index={1} total={total} />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="薪资区间">
            <SalarySection
              data={report.salary}
              positionName={position}
              targetEducation={report.meta.formData.targetEducation}
              index={2}
              total={total}
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="岗位信息">
            <PositionInfoSection
              data={report.positionInfo}
              positionName={position}
              index={3}
              total={total}
            />
          </SectionErrorBoundary>
          {report.resumeDiagnosis && (
            <SectionErrorBoundary name="简历诊断">
              <ResumeDiagnosisSection
                data={report.resumeDiagnosis}
                index={4}
                total={total}
              />
            </SectionErrorBoundary>
          )}
          <SectionErrorBoundary name="谈薪要点">
            <NegotiationSection
              data={report.salaryNegotiation}
              index={hasResume ? 5 : 4}
              total={total}
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="职场环境透视">
            <WorkplaceInsightSection
              data={report.workplaceInsight}
              index={hasResume ? 6 : 5}
              total={total}
            />
          </SectionErrorBoundary>

          {/* Disclaimer */}
          <div
            data-pdf-section="disclaimer"
            className="rounded-xl border border-[var(--blue-100)] bg-white p-4 text-[12px] leading-relaxed text-[var(--report-ink-muted)] break-inside-avoid-page"
          >
            <strong className="text-[var(--navy-700)]">免责声明：</strong>
            本报告由 AI 基于公开信息和你的输入生成，仅作为职业定位的参考，不构成就业、薪资或公司评价承诺。
            具体薪资以实际 offer 为准。职场环境透视聚焦行业与公司类型共性观察，不针对任何具体公司。
          </div>

          {/* 下载 PDF 按钮（PDF 导出模式下自动隐藏） */}
          {!isPdfMode && <DownloadPDFButton report={report} />}
        </div>
      </div>
    </ReportRenderContext.Provider>
  );
}
