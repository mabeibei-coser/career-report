"use client";

import { useState, useEffect, useCallback, useMemo, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, FileText, Clock, Users, Upload, ChevronDown, ChevronRight, AlertTriangle, RefreshCw, Inbox } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECTS, type ProjectId } from "@/lib/projects";

type ProjectFilter = ProjectId | "all";

interface ReportRow {
  id: number;
  created_at: number;
  project: ProjectId;
  target_position: string;
  target_education: string | null;
  work_years: string | null;
  user_name: string | null;
  user_phone: string | null;
  target_company: string | null;
  target_city_tier: string | null;
  has_resume: number;
  resume_filename: string | null;
  user_identity: string | null;
  uuid: string | null;
  duration_ms: number | null;
}

interface Stats {
  total: number;
  todayCount: number;
  resumeRate: number;
  avgDurationSec: number | null;
}

interface ApiResponse {
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  project: ProjectFilter;
  navReady: boolean;
  stats: Stats;
}

const IDENTITY_LABELS: Record<string, string> = {
  recent_grad: "应届毕业生",
  young_unemployed: "35岁以下求职者",
  general_unemployed: "35岁以上求职者",
};

// nav 的 form_data_json 学历是 code，admin 显示要映射成中文
const EDUCATION_LABELS: Record<string, string> = {
  junior_high: "初中及以下",
  high_school: "高中/中专/技校",
  junior_college: "高职/大专",
  bachelor: "本科",
  master_plus: "硕士及以上",
};

const WORK_YEARS_LABELS: Record<string, string> = {
  lt1: "0-1 年",
  "1to3": "1-3 年",
  "3to10": "3-10 年",
  gt10: "10 年以上",
};

// 简历 AI 提取时可能把字段标签误当成姓名，过滤掉这些常见误识别值
const NAME_BLACKLIST = new Set([
  "投递职位", "邮箱", "手机号", "手机", "电话号码", "电话",
  "姓名", "地址", "性别", "民族", "学历", "岗位", "邮件", "Email",
]);
function cleanName(v: string | null | undefined): string {
  if (!v) return "—";
  const trimmed = v.trim();
  if (NAME_BLACKLIST.has(trimmed)) return "—";
  return trimmed || "—";
}

function eduLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return EDUCATION_LABELS[v] ?? v;
}

function workYearsLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return WORK_YEARS_LABELS[v] ?? v;
}

function formatTs(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean; // 主指标：用蓝色强调
}) {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 border border-gray-100/80 hover:border-gray-200 transition-colors">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium mb-2">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <div
        className={`text-3xl font-semibold tabular-nums tracking-tight leading-none ${
          accent ? "text-blue-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-gray-400 mt-1.5">{sub}</div>}
    </div>
  );
}

function ProjectBadge({ project }: { project: ProjectId }) {
  const meta = PROJECTS[project];
  const palette =
    meta.color === "green"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${palette}`}
    >
      {meta.shortLabel}
    </span>
  );
}

function readProjectFromUrl(p: string | null): ProjectFilter {
  if (p === "all" || p === "report" || p === "nav") return p;
  return "all";
}

/** Page wrapper — Suspense 让 useSearchParams 能在 static prerender 通过 */
export default function AdminReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminReportsContent />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white border border-gray-100" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-white border border-gray-100" />
      </div>
    </div>
  );
}

function AdminReportsContent() {
  const searchParams = useSearchParams();
  const project = readProjectFromUrl(searchParams.get("project"));

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null); // id+project key

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [position, setPosition] = useState("");
  const [hasResume, setHasResume] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 切 project 时重置分页 + 收起 expand
  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
  }, [project]);

  // localStorage 记最近一次（侧栏未来可用作 default）
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin.lastProject", project);
    }
  }, [project]);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (position) params.set("position", position);
      if (hasResume) params.set("hasResume", hasResume);
      params.set("project", project);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/reports?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [from, to, position, hasResume, project, page]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  function handleSearch() {
    setPage(1);
    fetch_();
  }

  // 表格列模式：tab=all 时只显示通用列 + 展开按钮；单项目时显示项目专属列
  const showProjectSpecific = project !== "all";
  // 只在 navReady===false 时提示（避免 pm2 重启首次请求的短暂 false 污染状态）
  const navDegraded = data && !data.navReady;

  // 列定义（通用 + 项目专属）
  // 通用列把"姓名"+"手机号"放在"时间"之后（report 项目没这俩字段，显示 "—"）
  const columns = useMemo(() => {
    const common = ["时间", "姓名", "手机号", "项目"];
    if (project === "report")
      return [...common, "岗位", "学历", "公司", "城市", "简历", "耗时", "操作"];
    // 职业导航：用户要求去掉"耗时"列
    if (project === "nav")
      return [...common, "岗位", "用户身份", "学历", "工作年限", "操作"];
    return [...common, "岗位", "耗时", "详情"]; // all
  }, [project]);

  // 当前 project 的中文显示（标题用）
  const currentProjectLabel =
    project === "all" ? "全部报告" : `${PROJECTS[project as ProjectId].label}报告`;

  // 页头副标题：根据加载状态显示总数 + 今日新增
  const headerSub = (() => {
    if (loading) return "加载中…";
    if (!data) return "—";
    const t = data.stats.total;
    const today = data.stats.todayCount;
    const parts: string[] = [`共 ${t} 份`];
    if (today > 0) parts.push(`今日 +${today}`);
    if (project === "all") parts.push("两个项目合计");
    return parts.join(" · ");
  })();

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* 标题 */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              {currentProjectLabel}
            </h1>
            {project !== "all" && (
              <span className="text-xs text-gray-500">
                {PROJECTS[project as ProjectId].description ?? ""}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 tabular-nums">{headerSub}</p>
        </div>

        {/* nav 降级提示 */}
        {navDegraded && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              「职业导航」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查 <code>NAV_DB_PATH</code>。
            </div>
          </div>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="size-4" />}
            label="总报告数"
            value={data ? String(data.stats.total) : "—"}
            sub={project === "all" ? "两个项目合计" : PROJECTS[project as ProjectId].label}
          />
          <StatCard
            icon={<BarChart3 className="size-4" />}
            label="今日新增"
            value={data ? String(data.stats.todayCount) : "—"}
          />
          <StatCard
            icon={<Upload className="size-4" />}
            label="简历上传率"
            value={data ? `${data.stats.resumeRate}%` : "—"}
            accent
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="平均生成时长"
            value={
              data
                ? data.stats.avgDurationSec
                  ? `${data.stats.avgDurationSec}s`
                  : "—"
                : "—"
            }
          />
        </div>

        {/* 过滤栏 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <div className="text-xs text-gray-500 mb-1">开始日期</div>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 text-sm w-36"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">结束日期</div>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 text-sm w-36"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">意向岗位</div>
              <Input
                placeholder="关键词"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="h-8 text-sm w-36"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">简历</div>
              <select
                value={hasResume}
                onChange={(e) => setHasResume(e.target.value as "" | "1" | "0")}
                className="h-8 text-sm border border-input rounded-md px-2 bg-background"
              >
                <option value="">全部</option>
                <option value="1">有简历</option>
                <option value="0">无简历</option>
              </select>
            </div>
            <Button size="sm" onClick={handleSearch} className="h-8">
              搜索
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-gray-500"
              onClick={() => {
                setFrom("");
                setTo("");
                setPosition("");
                setHasResume("");
                setPage(1);
              }}
            >
              重置
            </Button>
          </div>
        </div>

        {/* 表格 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {error && (
            <div className="p-4 text-sm text-red-600 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <span>加载失败：{error}</span>
              <Button size="sm" variant="outline" onClick={fetch_} className="h-7 text-xs">
                <RefreshCw className="size-3 mr-1" />
                重试
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-gray-500">
                {columns.map((c) => (
                  <TableHead key={c} className={c === "操作" || c === "详情" ? "text-right" : ""}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {columns.map((c) => (
                      <TableCell key={c} className="py-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center">
                        <Inbox className="size-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm text-gray-600">
                          {project === "all"
                            ? "还没有人提交报告"
                            : `${PROJECTS[project as ProjectId].label} 暂无报告`}
                        </p>
                        <p className="text-xs text-gray-400">
                          当用户完成测评后，结果会出现在这里
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data?.rows.map((row) => {
                  const rowKey = `${row.project}-${row.id}`;
                  const expanded = expandedRow === rowKey;
                  return (
                    <ReportRowItem
                      key={rowKey}
                      row={row}
                      project={project}
                      showProjectSpecific={showProjectSpecific}
                      expanded={expanded}
                      onToggleExpand={() =>
                        setExpandedRow((prev) => (prev === rowKey ? null : rowKey))
                      }
                    />
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                共 {data.total} 条，第 {page}/{totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 单行：根据 project filter 渲染对应列；tab=all 时只显示通用 + 展开按钮 */
function ReportRowItem({
  row,
  project,
  showProjectSpecific,
  expanded,
  onToggleExpand,
}: {
  row: ReportRow;
  project: ProjectFilter;
  showProjectSpecific: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const meta = PROJECTS[row.project];
  const durationCell = row.duration_ms ? `${Math.round(row.duration_ms / 1000)}s` : "—";

  if (!showProjectSpecific) {
    // tab=all：通用列（时间/姓名/手机号/项目/岗位/耗时/详情）+ 展开按钮
    return (
      <>
        <TableRow className="text-sm cursor-pointer hover:bg-gray-50" onClick={onToggleExpand}>
          <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
            {formatTs(row.created_at)}
          </TableCell>
          <TableCell className="text-gray-700 max-w-[100px] truncate">
            {cleanName(row.user_name)}
          </TableCell>
          <TableCell className="tabular-nums text-xs text-gray-600 whitespace-nowrap">
            {row.user_phone || "—"}
          </TableCell>
          <TableCell>
            <ProjectBadge project={row.project} />
          </TableCell>
          <TableCell className="font-medium max-w-[180px] truncate">
            {row.target_position}
          </TableCell>
          <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">{durationCell}</TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Link
                href={`/admin/reports/${row.id}?project=${row.project}`}
                className="inline-flex items-center justify-center min-h-[28px] sm:min-h-0 text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                onClick={(e) => e.stopPropagation()}
              >
                详情
              </Link>
              {expanded ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
            </div>
          </TableCell>
        </TableRow>
        {expanded && (
          <TableRow className="bg-gray-50/50">
            <TableCell colSpan={7} className="px-4 py-3 text-xs">
              <ExpandedDetails row={row} />
            </TableCell>
          </TableRow>
        )}
      </>
    );
  }

  // tab=report：全列
  if (project === "report") {
    return (
      <TableRow className="text-sm">
        <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
          {formatTs(row.created_at)}
        </TableCell>
        <TableCell className="text-gray-700 max-w-[100px] truncate">
          {row.user_name || "—"}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-gray-600 whitespace-nowrap">
          {row.user_phone || "—"}
        </TableCell>
        <TableCell>
          <ProjectBadge project={row.project} />
        </TableCell>
        <TableCell className="font-medium max-w-[140px] truncate">{row.target_position}</TableCell>
        <TableCell className="text-gray-600">{eduLabel(row.target_education)}</TableCell>
        <TableCell className="text-gray-600 max-w-[120px] truncate">
          {row.target_company || "—"}
        </TableCell>
        <TableCell className="text-gray-600">{row.target_city_tier || "—"}</TableCell>
        <TableCell>
          {row.has_resume ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 text-[11px]">
              <FileText className="size-3" />有
            </span>
          ) : (
            <span className="text-gray-400 text-[11px]">无</span>
          )}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-gray-500">{durationCell}</TableCell>
        <TableCell className="text-right">
          <RowActions row={row} />
        </TableCell>
      </TableRow>
    );
  }

  // tab=nav：去掉耗时列（用户要求）
  return (
    <TableRow className="text-sm">
      <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
        {formatTs(row.created_at)}
      </TableCell>
      <TableCell className="text-gray-700 max-w-[100px] truncate">
        {row.user_name || "—"}
      </TableCell>
      <TableCell className="tabular-nums text-xs text-gray-600 whitespace-nowrap">
        {row.user_phone || "—"}
      </TableCell>
      <TableCell>
        <ProjectBadge project={row.project} />
      </TableCell>
      <TableCell className="font-medium max-w-[140px] truncate">{row.target_position}</TableCell>
      <TableCell className="text-gray-600">
        {row.user_identity ? IDENTITY_LABELS[row.user_identity] ?? row.user_identity : "—"}
      </TableCell>
      <TableCell className="text-gray-600">{eduLabel(row.target_education)}</TableCell>
      <TableCell className="text-gray-600">{workYearsLabel(row.work_years)}</TableCell>
      <TableCell className="text-right">
        <RowActions row={row} />
      </TableCell>
    </TableRow>
  );
}

function RowActions({ row }: { row: ReportRow }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {row.has_resume ? (
        <a
          href={`/api/admin/reports/${row.id}/resume?project=${row.project}`}
          download
          className="inline-flex items-center justify-center min-h-[28px] sm:min-h-0 text-xs px-2.5 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          简历
        </a>
      ) : null}
      <Link
        href={`/admin/reports/${row.id}?project=${row.project}`}
        className="inline-flex items-center justify-center min-h-[28px] sm:min-h-0 text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
      >
        详情
      </Link>
    </div>
  );
}

function ExpandedDetails({ row }: { row: ReportRow }) {
  if (row.project === "report") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600">
        <div><span className="text-gray-400">学历：</span>{eduLabel(row.target_education)}</div>
        <div><span className="text-gray-400">公司：</span>{row.target_company ?? "—"}</div>
        <div><span className="text-gray-400">城市：</span>{row.target_city_tier ?? "—"}</div>
        <div>
          <span className="text-gray-400">简历：</span>
          {row.has_resume ? (
            <a
              href={`/api/admin/reports/${row.id}/resume?project=${row.project}`}
              download
              className="text-blue-600 hover:underline"
            >
              下载
            </a>
          ) : (
            "无"
          )}
        </div>
      </div>
    );
  }
  // nav
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600">
      <div>
        <span className="text-gray-400">用户身份：</span>
        {row.user_identity ? IDENTITY_LABELS[row.user_identity] ?? row.user_identity : "—"}
      </div>
      <div><span className="text-gray-400">学历：</span>{eduLabel(row.target_education)}</div>
      <div><span className="text-gray-400">工作年限：</span>{workYearsLabel(row.work_years)}</div>
      <div><span className="text-gray-400">手机号：</span>{row.user_phone || "—"}</div>
      <div>
        <span className="text-gray-400">简历：</span>
        {row.has_resume ? (
          <a
            href={`/api/admin/reports/${row.id}/resume?project=${row.project}`}
            download
            className="text-blue-600 hover:underline"
          >
            下载
          </a>
        ) : (
          "无"
        )}
      </div>
    </div>
  );
}
