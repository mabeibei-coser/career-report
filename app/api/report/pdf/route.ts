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
      // 'shell' 模式使用轻量级 chrome-headless-shell（～60MB），体积小、启动快，
      // 足够渲染 PDF；完整 chrome 放着不用以免 puppeteer 启动时找不到二进制
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

    // Step 1: 跳到目标域的 about:blank 初始化 main frame + 允许后续 sessionStorage 写入
    await page.goto(`${INTERNAL_BASE}/api/_ping_or_404`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    }).catch(() => {/* 404 is fine, we just need a same-origin document */});

    // Step 2: 在同源 context 里写 sessionStorage
    await page.evaluate((dataStr: string) => {
      try {
        window.sessionStorage.setItem("reportData", dataStr);
      } catch {
        /* ignore */
      }
    }, JSON.stringify(reportData));

    // Step 3: 跳真正的 /report 页面
    const url = `${INTERNAL_BASE}/report?pdf=1`;
    // dev 模式下 Turbopack 首次编译 /report 可能要 30-60s，生产 build 后几秒
    // timeout 放宽到 60s 保证 dev 也能生成 PDF；生产环境远不会用满
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // React hydrate 完成后 section 才出现。dev 模式首次编译 + hydrate 可能很慢
    // 超时放宽到 60s 覆盖 Turbopack 冷启动
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
