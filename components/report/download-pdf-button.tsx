"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, RotateCw } from "lucide-react";
import type { ReportData } from "@/lib/types";

interface Props {
  report: ReportData;
}

type Status = "preparing" | "ready" | "downloading" | "error";

// 检测常见国产 in-app 浏览器（微信/QQ/钉钉/微博/UC/百度等）
// 这些 WebView 对 blob + <a download> 兼容差，需要提示用户在外部浏览器打开
function detectInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger|QQ\/|QQBrowser|DingTalk|Weibo|UCBrowser|Baidu|BaiduHD|MQQBrowser/i.test(
    navigator.userAgent
  );
}

export function DownloadPDFButton({ report }: Props) {
  const [status, setStatus] = useState<Status>("preparing");
  const [token, setToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInApp, setIsInApp] = useState(false);
  // epoch 用来强制重跑 useEffect 进行"重试"
  const [prepEpoch, setPrepEpoch] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setIsInApp(detectInAppBrowser());
  }, []);

  // 挂载即 prep：POST /prepare 拿 token，同时服务端在 pdf-job-store 里 fire-and-forget
  // 启动 Puppeteer 后台渲染。点击时 GET /pdf?token=xxx，已完成秒出，未完成 hold 住等完成。
  useEffect(() => {
    cancelledRef.current = false;
    setStatus("preparing");
    setErrorMsg(null);

    (async () => {
      try {
        const res = await fetch("/api/report/pdf/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportData: report }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `准备失败 HTTP ${res.status}`);
        }
        const { token: newToken } = (await res.json()) as { token: string };
        if (!cancelledRef.current) {
          setToken(newToken);
          setStatus("ready");
        }
      } catch (e) {
        if (!cancelledRef.current) {
          console.error("[pdf-button] prepare failed:", e);
          setErrorMsg(e instanceof Error ? e.message : "准备下载链接失败");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
    // 依赖 prepEpoch：点"重试"按钮时自增 → 触发新一轮 prep
    // report 引用变化也会重跑，保证 reportData 最新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepEpoch, report]);

  const onClick = () => {
    if (status !== "ready" || !token) return;
    setStatus("downloading");

    const url = `/api/report/pdf?token=${encodeURIComponent(token)}`;

    // 同步打开新窗口（token 已有，window.open 是第一个语句，仍在用户手势内）
    const popup = window.open(url, "_blank");

    if (!popup || popup.closed) {
      // popup 被拦截 fallback 到当前标签：服务端 Content-Disposition: attachment
      // 浏览器会触发下载而不是实际跳转页面
      window.location.href = url;
    }

    // 恢复按钮可点击（浏览器已接管下载流）
    setTimeout(() => {
      if (!cancelledRef.current) setStatus("ready");
    }, 1500);
  };

  const onRetry = () => {
    setPrepEpoch((n) => n + 1);
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
        onClick={status === "error" ? onRetry : onClick}
        disabled={status === "preparing" || status === "downloading"}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--blue-500)] hover:bg-[var(--blue-600)] text-white font-semibold px-6 py-3 text-[15px] shadow-sm transition-all disabled:opacity-70 disabled:cursor-wait min-w-[200px] justify-center"
      >
        {status === "preparing" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>准备下载链接…</span>
          </>
        ) : status === "downloading" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>正在下载…</span>
          </>
        ) : status === "error" ? (
          <>
            <RotateCw className="size-4" />
            <span>准备失败，点击重试</span>
          </>
        ) : (
          <>
            <Download className="size-4" />
            <span>下载 PDF 报告</span>
          </>
        )}
      </button>
      {status === "error" && errorMsg && (
        <p className="text-[12px] text-red-600 max-w-md text-center">{errorMsg}</p>
      )}
    </div>
  );
}
