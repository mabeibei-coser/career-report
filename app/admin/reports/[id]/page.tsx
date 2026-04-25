import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import fs from "fs";
import { ChevronLeft, Download, ExternalLink } from "lucide-react";
import type { JobFormData, QuizAnswer } from "@/lib/types";

interface ReportMeta {
  id: number;
  created_at: number;
  target_position: string;
  target_education: string;
  target_company: string;
  target_city_tier: string;
  has_resume: number;
  resume_filename: string | null;
  resume_storage_path: string | null;
  report_storage_path: string | null;
  sections_status: string | null;
  ip: string | null;
  duration_ms: number | null;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="shrink-0 w-28 text-xs text-gray-500 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 break-all">{value ?? "—"}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const db = getDb();
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as
    | ReportMeta
    | undefined;

  if (!row) notFound();

  let reportData: Record<string, unknown> | null = null;
  if (row.report_storage_path) {
    try {
      reportData = JSON.parse(
        fs.readFileSync(row.report_storage_path, "utf-8")
      ) as Record<string, unknown>;
    } catch {
      // missing or corrupt
    }
  }

  const formData = (reportData?.formData ?? null) as JobFormData | null;
  const quizAnswers = (reportData?.quizAnswers ?? []) as QuizAnswer[];
  const resumeFileExists =
    row.has_resume &&
    row.resume_storage_path &&
    fs.existsSync(row.resume_storage_path);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 返回链接 */}
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="size-4" />
          报告列表
        </Link>

        {/* 元数据 */}
        <Card title="基本信息">
          <Row label="ID" value={row.id} />
          <Row
            label="创建时间"
            value={new Date(row.created_at).toLocaleString("zh-CN")}
          />
          <Row label="意向岗位" value={row.target_position} />
          <Row label="学历要求" value={row.target_education} />
          <Row label="意向公司" value={row.target_company} />
          <Row label="城市能级" value={row.target_city_tier} />
          <Row label="IP" value={row.ip} />
          <Row
            label="生成耗时"
            value={row.duration_ms ? `${Math.round(row.duration_ms / 1000)}s` : null}
          />
          <Row
            label="简历文件"
            value={
              row.has_resume ? (
                resumeFileExists ? (
                  <a
                    href={`/api/admin/reports/${row.id}/resume`}
                    download
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Download className="size-3.5" />
                    {row.resume_filename}
                  </a>
                ) : (
                  <span className="text-amber-600 text-xs">文件已丢失（{row.resume_filename}）</span>
                )
              ) : (
                "未上传"
              )
            }
          />
        </Card>

        {/* 表单原始数据 */}
        {formData && (
          <Card title="填报信息（原始）">
            <Row label="意向岗位" value={formData.targetPosition} />
            <Row label="学历" value={formData.targetEducation} />
            <Row label="意向公司" value={formData.targetCompany} />
            <Row label="城市能级" value={formData.targetCityTier} />
            {formData.resumeText && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1.5">简历文本（摘录前 500 字）</div>
                <pre className="text-[11px] bg-gray-50 rounded p-3 overflow-auto whitespace-pre-wrap text-gray-700 max-h-40">
                  {formData.resumeText.slice(0, 500)}
                  {formData.resumeText.length > 500 ? "…" : ""}
                </pre>
              </div>
            )}
          </Card>
        )}

        {/* 测评作答 */}
        {quizAnswers.length > 0 && (
          <Card title={`测评作答（${quizAnswers.length} 题）`}>
            <div className="space-y-2">
              {quizAnswers.map((a, i) => (
                <div key={a.questionId} className="text-sm">
                  <span className="text-gray-400 text-xs mr-2">Q{i + 1}</span>
                  <span className="text-gray-700">{a.questionText}</span>
                  <div className="ml-6 mt-0.5 text-xs text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded">
                    {a.selectedKey}. {a.selectedLabel}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 操作区 */}
        <div className="flex gap-3">
          {reportData ? (
            <Link
              href={`/admin/reports/${row.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
            >
              <ExternalLink className="size-4" />
              查看报告预览
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-400 text-sm rounded-lg cursor-not-allowed">
              <ExternalLink className="size-4" />
              报告数据不可用
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
