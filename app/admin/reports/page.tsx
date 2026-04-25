"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { BarChart3, FileText, Clock, Users, Upload } from "lucide-react";
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

interface ReportRow {
  id: number;
  created_at: number;
  target_position: string;
  target_education: string;
  target_company: string;
  target_city_tier: string;
  has_resume: number;
  resume_filename: string | null;
  sections_status: string | null;
  ip: string | null;
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
  stats: Stats;
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
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex items-start gap-3">
      <div className="shrink-0 size-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [position, setPosition] = useState("");
  const [hasResume, setHasResume] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (position) params.set("position", position);
      if (hasResume) params.set("hasResume", hasResume);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/reports?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [from, to, position, hasResume, page]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  function handleSearch() {
    setPage(1);
    fetch_();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="size-4" />}
            label="总报告数"
            value={data ? String(data.stats.total) : "—"}
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
            <div className="p-4 text-sm text-red-600 border-b border-red-100 bg-red-50">
              {error}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-gray-500">
                <TableHead className="w-12">ID</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>学历</TableHead>
                <TableHead>意向公司</TableHead>
                <TableHead>城市</TableHead>
                <TableHead>简历</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : data?.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                data?.rows.map((row) => (
                  <TableRow key={row.id} className="text-sm">
                    <TableCell className="text-gray-400 text-xs">{row.id}</TableCell>
                    <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
                      {formatTs(row.created_at)}
                    </TableCell>
                    <TableCell className="font-medium max-w-[140px] truncate">
                      {row.target_position}
                    </TableCell>
                    <TableCell className="text-gray-600">{row.target_education}</TableCell>
                    <TableCell className="text-gray-600 max-w-[120px] truncate">
                      {row.target_company || "—"}
                    </TableCell>
                    <TableCell className="text-gray-600">{row.target_city_tier || "—"}</TableCell>
                    <TableCell>
                      {row.has_resume ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 text-[11px]">
                          <FileText className="size-3" />
                          有
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">无</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-gray-500">
                      {row.duration_ms ? `${Math.round(row.duration_ms / 1000)}s` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/reports/${row.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        详情
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
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
