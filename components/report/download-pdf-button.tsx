"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ReportData } from "@/lib/types";

interface Props {
  report: ReportData;
}

export function DownloadPDFButton({ report }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onClick = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData: report }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      // 从 Content-Disposition 解析 UTF-8 文件名
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename\*=UTF-8''([^;\n]+)/i.exec(cd);
      const filename = m
        ? decodeURIComponent(m[1])
        : `校招定位报告_${report.meta.formData.targetPosition}.pdf`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("idle");
    } catch (e) {
      console.error("[pdf-button] download failed:", e);
      setErrorMsg(e instanceof Error ? e.message : "下载失败");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-6 print:hidden">
      <button
        type="button"
        onClick={onClick}
        disabled={status === "loading"}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--blue-500)] hover:bg-[var(--blue-600)] text-white font-semibold px-6 py-3 text-[15px] shadow-sm transition-all disabled:opacity-70 disabled:cursor-wait min-w-[200px] justify-center"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>正在生成 PDF…约 10 秒</span>
          </>
        ) : (
          <>
            <Download className="size-4" />
            <span>下载 PDF 报告</span>
          </>
        )}
      </button>
      {errorMsg && (
        <p className="text-[12px] text-red-600">
          {errorMsg}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              setErrorMsg(null);
              setStatus("idle");
            }}
          >
            重试
          </button>
        </p>
      )}
      <p className="text-[11px] text-[var(--report-ink-muted)]">
        PDF 保留完整 6 章节内容，文字可选可搜，无分页截断
      </p>
    </div>
  );
}
