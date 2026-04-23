import { NextRequest, NextResponse } from "next/server";
import type { ReportData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180; // dev 模式 Turbopack 冷编译 /report + Puppeteer 启动 + 渲染合计可能 ~90-120s

// 通过 127.0.0.1 让 headless Chromium 回访自己的页面
const INTERNAL_BASE =
  process.env.PDF_INTERNAL_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

function todayYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export async function POST(req: NextRequest) {
  let body: { reportData?: ReportData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体解析失败" }, { status: 400 });
  }

  const reportData = body?.reportData;
  if (!reportData?.meta?.formData?.targetPosition) {
    return NextResponse.json({ error: "缺少 reportData" }, { status: 400 });
  }

  // 动态 import puppeteer，避免构建期被静态分析报错
  const puppeteer = await import("puppeteer");

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      // shell 模式（chrome-headless-shell）是预装好的轻量 Chrome。
      // 完整 Chrome 需 `npx puppeteer browsers install chrome` 联网下载 ~150MB，
      // 国内网络下载困难，所以保持 shell 模式兼容
      headless: "shell",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--hide-scrollbars",
        "--font-render-hinting=none",
      ],
    });

    const page = await browser.newPage();

    // 仅捕获页面里的未捕获异常（正常 console 不转发，避免污染服务端日志）
    page.on("pageerror", (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[pdf:pageerror]", msg);
    });

    // 桌面布局 + 2x DPI
    await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 2 });

    // 关键：用 evaluateOnNewDocument 让"写 sessionStorage"脚本在每个页面加载
    // 最早期运行，**早于任何页面 JS**。比起原来"先跳 404 页再 evaluate 再跳真页"
    // 三步流程更稳，不会因 navigation 之间 sessionStorage 被清空而失败。
    // 注意：这个脚本会在每次 navigation 前运行，所以直接 goto 即可。
    const reportDataStr = JSON.stringify(reportData);
    await page.evaluateOnNewDocument((dataStr: string) => {
      try {
        window.sessionStorage.setItem("reportData", dataStr);
      } catch {
        /* ignore storage errors */
      }
    }, reportDataStr);

    // 直接跳 /report 页面，sessionStorage 在任何页面 JS 执行前已注入
    // dev 模式 Turbopack 首次编译 /report 可能 30-60s
    const url = `${INTERNAL_BASE}/report?pdf=1`;
    // waitUntil: "load"（比 domcontentloaded 晚，等所有资源加载完；
    // 不用 networkidle0 因为 dev 模式 HMR websocket 永远不 idle）
    await page.goto(url, { waitUntil: "load", timeout: 60000 });

    // React hydrate 完成后 section 才出现。shell 模式下 hydration 可能较慢
    await page.waitForSelector("[data-pdf-section]", { timeout: 60000 });
    await page.evaluate(() => document.fonts?.ready);
    // 再多等 800ms 给 framer-motion / recharts 初始渲染收敛
    await new Promise((r) => setTimeout(r, 800));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "14mm", right: "10mm", bottom: "18mm", left: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%; padding:0 10mm; font-size:9px; color:#6b7280; display:flex; justify-content:space-between; font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif;">
          <span>谨世 ATA · 职业定位报告</span>
          <span>第 <span class="pageNumber"></span> / <span class="totalPages"></span> 页</span>
        </div>
      `,
    });

    const position = reportData.meta.formData.targetPosition;
    const filename = `校招定位报告_${position}_${todayYYYYMMDD()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf] generation failed:", e);
    const message = e instanceof Error ? e.message : "PDF 生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}
