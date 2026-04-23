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

    // 关键：必须在 await fetch 之前同步 window.open，否则
    // popup blocker 会把异步手势里的新窗口当普通弹窗拦截掉（表现：点了没反应）
    // 先开空白窗口占位，拿到 token 后再把它导航到真实下载 URL
    const popup = window.open("", "_blank");

    try {
      // Step 1: 获取 token（快，<1 秒）
      const prepRes = await fetch("/api/report/pdf/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData: report }),
      });
      if (!prepRes.ok) {
        const j = await prepRes.json().catch(() => ({}));
        throw new Error((j as {error?: string}).error || `准备失败 HTTP ${prepRes.status}`);
      }
      const { token } = await prepRes.json() as { token: string };
      const downloadUrl = `/api/report/pdf?token=${encodeURIComponent(token)}`;

      if (popup && !popup.closed) {
        // 预开的新窗口还活着 → 把它导航到下载 URL
        popup.location.href = downloadUrl;
      } else {
        // popup 被拦截或被用户手动关了 → 降级为当前标签跳转
        // 服务端返回 Content-Disposition: attachment，浏览器会触发下载而不是真的跳转页面
        window.location.href = downloadUrl;
      }
      setStatus("idle");
    } catch (e) {
      // 失败了关掉那个空白窗口，避免留一个死链
      if (popup && !popup.closed) {
        try { popup.close(); } catch { /* ignore */ }
      }
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
            <span>正在准备下载…</span>
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
