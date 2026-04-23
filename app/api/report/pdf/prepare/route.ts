import { NextRequest, NextResponse } from "next/server";
import type { ReportData } from "@/lib/types";
import { putReportData } from "@/lib/pdf-token-store";

export const runtime = "nodejs";

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
  return NextResponse.json({ token });
}
