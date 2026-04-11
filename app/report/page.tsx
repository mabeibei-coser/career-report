"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ReportData } from "@/lib/types";

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const CHART_COLORS = [
  "oklch(0.55 0.18 250)",
  "oklch(0.65 0.14 230)",
  "oklch(0.5 0.12 270)",
  "oklch(0.7 0.08 210)",
  "oklch(0.4 0.15 250)",
];

function Section({
  title,
  badge,
  children,
  delay = 0,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: cubicEase }}
      className="bg-white rounded-2xl border border-[var(--blue-100)] shadow-sm p-6 md:p-8"
    >
      <div className="flex items-center gap-3 mb-5">
        {badge && (
          <Badge
            variant="secondary"
            className="bg-[var(--blue-100)] text-[var(--navy-700)] text-xs"
          >
            {badge}
          </Badge>
        )}
        <h2 className="text-lg font-semibold text-[var(--navy-950)]">
          {title}
        </h2>
      </div>
      {children}
    </motion.section>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current || !report) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f0f4ff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = 297; // A4 height in mm

      const pdf = new jsPDF("p", "mm", "a4");
      let position = 0;
      let heightLeft = imgHeight;

      // First page
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Additional pages
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `职业定位报告_${report.meta.formData.positionName}_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "")}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("PDF 导出失败，请尝试使用打印功能");
    } finally {
      setExporting(false);
    }
  }, [report]);

  useEffect(() => {
    const stored = sessionStorage.getItem("reportData");
    if (!stored) {
      router.push("/form");
      return;
    }
    try {
      const data = JSON.parse(stored) as ReportData;
      setReport(data);
    } catch {
      router.push("/form");
    }
  }, [router]);

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--blue-500)] border-t-transparent rounded-full" />
      </div>
    );
  }

  const { meta, summary, jobOverview, industryAnalysis, competencyProfile, developmentPath, personalizedAdvice, supplementary } = report;

  const radarData = competencyProfile.dimensions.map((d) => ({
    subject: d.name,
    value: d.score,
    fullMark: 100,
  }));

  const pieData = jobOverview.responsibilities.map((r) => ({
    name: r.name,
    value: r.weight,
  }));

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)]" />
      <div className="fixed inset-0 hero-grid opacity-20" />

      <div ref={reportRef} className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: cubicEase }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-[var(--navy-950)] to-[var(--navy-800)] rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="hero-grid absolute inset-0 opacity-10" />
            <div className="relative z-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <Badge className="bg-white/15 text-white/80 text-xs mb-3 backdrop-blur-sm">
                    AI 职业定位报告
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    {meta.formData.positionName}
                  </h1>
                  <div className="flex flex-wrap gap-2 text-sm text-white/60">
                    <span>{meta.formData.industry}</span>
                    <span>·</span>
                    <span>{meta.formData.companyType}</span>
                    <span>·</span>
                    <span>{meta.formData.cityLevel}</span>
                    <span>·</span>
                    <span>{meta.formData.jobLevel}</span>
                  </div>
                </div>
                <div className="text-right text-sm text-white/50">
                  <p>工作年限：{meta.formData.workYears}</p>
                  <p>{meta.interviewSummary}</p>
                  <p className="mt-1">
                    {new Date(meta.generatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Report sections */}
        <div className="space-y-6">
          {/* 1. Summary */}
          <Section title="职业定位总述" badge="总览" delay={0.1}>
            <p className="text-[var(--navy-800)] leading-relaxed text-sm">
              {summary}
            </p>
          </Section>

          {/* 2. Job Overview with Pie Chart */}
          <Section title="岗位概览" badge="岗位" delay={0.15}>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">岗位定位</p>
                  <p className="text-sm text-[var(--navy-800)]">{jobOverview.positioning}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">岗位类型</p>
                  <p className="text-sm text-[var(--navy-800)]">{jobOverview.roleType}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">职级要求</p>
                  <p className="text-sm text-[var(--navy-800)]">{jobOverview.levelRequirements}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-3 text-center">核心职责分布</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      animationBegin={400}
                      animationDuration={1200}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value}%`, "占比"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--blue-100)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-[var(--navy-700)]">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {item.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 3. Industry Analysis */}
          <Section title="行业洞察" badge="行业" delay={0.2}>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "行业趋势", value: industryAnalysis.trend },
                  { label: "需求变化", value: industryAnalysis.demandChange },
                  { label: "竞争态势", value: industryAnalysis.competition },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-[var(--blue-50)] rounded-xl p-4"
                  >
                    <p className="text-xs text-[var(--navy-600)] font-medium mb-2">{item.label}</p>
                    <p className="text-sm text-[var(--navy-800)] leading-relaxed">{item.value}</p>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-3">
                <p className="text-xs text-[var(--muted-foreground)] font-medium">关键洞察</p>
                {industryAnalysis.insights.map((insight, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--blue-100)] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-[var(--navy-700)]">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--navy-900)]">{insight.title}</p>
                      <p className="text-sm text-[var(--navy-700)] mt-0.5">{insight.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* 4. Competency Radar Chart */}
          <Section title="能力画像" badge="能力" delay={0.25}>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--blue-200)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fontSize: 12, fill: "var(--navy-700)" }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <Radar
                      name="能力值"
                      dataKey="value"
                      stroke="oklch(0.55 0.18 250)"
                      fill="oklch(0.55 0.18 250)"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      animationBegin={600}
                      animationDuration={1000}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {competencyProfile.dimensions.map((dim, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[var(--navy-800)] flex items-center gap-2">
                        {dim.name}
                        {dim.isCore && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[var(--blue-300)] text-[var(--navy-600)]">
                            核心
                          </Badge>
                        )}
                      </span>
                      <span className="text-sm font-medium text-[var(--navy-900)]">
                        {dim.score}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--blue-100)] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${dim.score}%` }}
                        transition={{ duration: 1, delay: 0.8 + i * 0.1, ease: cubicEase }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${CHART_COLORS[i]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">{dim.description}</p>
                  </div>
                ))}
                <Separator className="my-3" />
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-2">高绩效者特征</p>
                  <div className="flex flex-wrap gap-2">
                    {competencyProfile.highPerformerTraits.map((trait, i) => (
                      <Badge key={i} variant="secondary" className="bg-[var(--blue-50)] text-[var(--navy-700)] text-xs">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 5. Development Path */}
          <Section title="发展路径" badge="发展" delay={0.3}>
            <div className="space-y-5">
              <div className="bg-[var(--blue-50)] rounded-xl p-4">
                <p className="text-xs text-[var(--navy-600)] font-medium mb-1">当前阶段</p>
                <p className="text-sm text-[var(--navy-800)]">{developmentPath.currentStage}</p>
              </div>

              {/* Upward paths */}
              <div>
                <p className="text-xs text-[var(--muted-foreground)] font-medium mb-3">晋升方向</p>
                <div className="space-y-3">
                  {developmentPath.upwardPaths.map((path, i) => (
                    <div key={i} className="border border-[var(--blue-100)] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 12V4M5 7l3-3 3 3" stroke="var(--blue-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <p className="text-sm font-medium text-[var(--navy-900)]">{path.title}</p>
                      </div>
                      <p className="text-sm text-[var(--navy-700)] mb-2">{path.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {path.requiredSkills.map((skill, j) => (
                          <Badge key={j} variant="outline" className="text-[10px] border-[var(--blue-200)] text-[var(--navy-600)]">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lateral paths */}
              <div>
                <p className="text-xs text-[var(--muted-foreground)] font-medium mb-3">横向发展</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {developmentPath.lateralPaths.map((path, i) => (
                    <div key={i} className="border border-[var(--blue-100)] rounded-xl p-4">
                      <p className="text-sm font-medium text-[var(--navy-900)] mb-1">{path.title}</p>
                      <p className="text-sm text-[var(--navy-700)]">{path.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advice timeline */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-[var(--blue-50)] rounded-xl p-4">
                  <p className="text-xs text-[var(--navy-600)] font-medium mb-3">短期建议（0-6个月）</p>
                  <ul className="space-y-2">
                    {developmentPath.shortTermAdvice.map((advice, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[var(--navy-800)]">
                        <span className="text-[var(--blue-500)] mt-0.5">•</span>
                        {advice}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-[var(--blue-50)] rounded-xl p-4">
                  <p className="text-xs text-[var(--navy-600)] font-medium mb-3">中期建议（6-18个月）</p>
                  <ul className="space-y-2">
                    {developmentPath.midTermAdvice.map((advice, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[var(--navy-800)]">
                        <span className="text-[var(--blue-500)] mt-0.5">•</span>
                        {advice}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          {/* 6. Personalized Advice */}
          <Section title="个性化建议" badge="建议" delay={0.35}>
            <div className="space-y-4">
              {personalizedAdvice.items.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--navy-800)] to-[var(--blue-500)] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--navy-900)] mb-1">{item.title}</p>
                    <p className="text-sm text-[var(--navy-700)] leading-relaxed">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 7. Supplementary */}
          <Section title="补充信息" badge="参考" delay={0.4}>
            <div className="space-y-4">
              {/* Salary range */}
              <div className="bg-[var(--blue-50)] rounded-xl p-4">
                <p className="text-xs text-[var(--navy-600)] font-medium mb-3">薪酬参考范围</p>
                <div className="flex items-end justify-between max-w-md">
                  {[
                    { label: "低位", value: supplementary.salaryRange.low },
                    { label: "中位数", value: supplementary.salaryRange.median, highlight: true },
                    { label: "高位", value: supplementary.salaryRange.high },
                  ].map((item, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs text-[var(--muted-foreground)] mb-1">{item.label}</p>
                      <p className={`text-lg font-bold ${item.highlight ? "text-[var(--navy-900)]" : "text-[var(--navy-700)]"}`}>
                        {(item.value / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{supplementary.salaryRange.unit}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-2 bg-[var(--blue-200)] rounded-full relative">
                  <div
                    className="absolute h-full rounded-full bg-gradient-to-r from-[var(--blue-400)] to-[var(--blue-500)]"
                    style={{
                      left: `${(supplementary.salaryRange.low / supplementary.salaryRange.high) * 100}%`,
                      right: "0%",
                    }}
                  />
                </div>
              </div>

              {/* Benchmark roles */}
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-2">对标岗位</p>
                <div className="flex flex-wrap gap-2">
                  {supplementary.benchmarkRoles.map((role, i) => (
                    <Badge key={i} variant="secondary" className="bg-[var(--blue-50)] text-[var(--navy-700)]">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-gray-50 rounded-xl p-4 mt-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  {supplementary.disclaimer}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {supplementary.sources.map((src, i) => (
                    <span key={i} className="text-[10px] text-gray-400">
                      {src}{i < supplementary.sources.length - 1 ? " ·" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: cubicEase }}
            className="flex flex-col sm:flex-row gap-3 justify-center py-8"
          >
            <Button
              onClick={handleExportPDF}
              disabled={exporting}
              variant="outline"
              className="h-11 px-6 rounded-xl border-[var(--blue-200)] text-[var(--navy-700)] hover:bg-[var(--blue-50)]"
            >
              {exporting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  导出中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  导出 PDF
                </span>
              )}
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="h-11 px-6 rounded-xl border-[var(--blue-200)] text-[var(--navy-700)] hover:bg-[var(--blue-50)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2">
                <rect x="3" y="9" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5 9V3h6v6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2 6h12v5H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              打印报告
            </Button>
            <Button
              onClick={() => {
                sessionStorage.clear();
                router.push("/");
              }}
              className="h-11 px-6 bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white rounded-xl btn-glow"
            >
              开始新的分析
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
