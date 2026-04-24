import { NextRequest, NextResponse } from "next/server";
import type { ReportData } from "@/lib/types";
import { putReportData } from "@/lib/pdf-token-store";
import { startJob } from "@/lib/pdf-job-store";
import { renderPdfBuffer } from "@/app/api/report/pdf/route";

export const runtime = "nodejs";
// renderPdfBuffer 要起 Puppeteer，虽然 fire-and-forget 但让 handler 进程能撑足够久
export const maxDuration = 180;

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
  const token = putReportData(reportData);
  // fire-and-forget 启动后台渲染；不 await。同 token 二次 startJob 幂等返回已有 job。
  // 即使本次请求返回后，Next.js 进程仍会在后台 hold 住 Promise（Node 不会主动 kill 活跃任务）
  startJob(token, reportData, renderPdfBuffer);
  return NextResponse.json({ token });
}
