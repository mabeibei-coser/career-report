"use client";

import { useEffect, useMemo, useState } from "react";
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

function loadReportFromSession(): ReportData | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem("reportData");
  if (!stored) return null;
  try {
    const data = JSON.parse(stored) as ReportData;
    if (!data?.meta?.formData?.targetPosition) return null;
    // Schema sanity check
    if (
      !data.overview?.strength?.title ||
      !data.overview?.improvement?.title ||
      !data.overview?.personality?.type ||
      !data.salaryNegotiation?.aiExperience ||
      !data.workplaceInsight?.companyInsight?.developmentSummary ||
      !data.positionInfo?.subPositions?.[0]?.fitReason
    ) {
      sessionStorage.removeItem("reportData");
      return null;
    }
    return data;
  } catch {
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
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("pdf") === "1") setIsPdfMode(true);
    setReport(loadReportFromSession());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !report) {
      router.replace("/form");
    }
  }, [loaded, router, report]);

  const ctxValue = useMemo(() => ({ exporting: isPdfMode }), [isPdfMode]);

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--blue-50)]/60 to-white">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--blue-500)] border-t-transparent rounded-full" />
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

        {/* Sections */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-4 sm:space-y-5">
          <OverviewSection data={report.overview} index={1} total={total} />
          <SalarySection
            data={report.salary}
            positionName={position}
            targetEducation={report.meta.formData.targetEducation}
            index={2}
            total={total}
          />
          <PositionInfoSection
            data={report.positionInfo}
            positionName={position}
            index={3}
            total={total}
          />
          {report.resumeDiagnosis && (
            <ResumeDiagnosisSection
              data={report.resumeDiagnosis}
              index={4}
              total={total}
            />
          )}
          <NegotiationSection
            data={report.salaryNegotiation}
            index={hasResume ? 5 : 4}
            total={total}
          />
          <WorkplaceInsightSection
            data={report.workplaceInsight}
            index={hasResume ? 6 : 5}
            total={total}
          />

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
