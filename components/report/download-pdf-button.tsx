"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ReportData } from "@/lib/types";

interface Props {
  report: ReportData;
}

// 检测常见国产 in-app 浏览器（微信/QQ/钉钉/微博/UC/百度等）
// 这些 WebView 对 blob + <a download> 兼容差，需要提示用户在外部浏览器打开
function detectInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger|QQ\/|QQBrowser|DingTalk|Weibo|UCBrowser|Baidu|BaiduHD|MQQBrowser/i.test(
    navigator.userAgent
  );
}

export function DownloadPDFButton({ report }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    setIsInApp(detectInAppBrowser());
  }, []);

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
      // download 属性被忽略时（部分 Android 系统浏览器 / 国产 WebView），
      // target=_blank 让 PDF 至少在新标签页打开，用户可在 PDF viewer 里保存
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();

      // 关键：延迟 10s 再清理，给 Android Chrome / 某些 WebView 的
      // 异步下载流程足够时间去抓取 blob。立即 revoke 会导致下载空文件
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 10_000);

      setStatus("idle");
    } catch (e) {
      console.error("[pdf-button] download failed:", e);
      setErrorMsg(e instanceof Error ? e.message : "下载失败");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-6 print:hidden">
      {isInApp && (
        <p className="max-w-md text-[12px] leading-relaxed text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          检测到微信 / QQ / 钉钉等内置浏览器，PDF 下载可能失败。请点击右上角「⋯」菜单 →
          选择「在浏览器中打开」后再点下载。
        </p>
      )}
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
    </div>
  );
}
