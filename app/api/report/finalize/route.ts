import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      formData,
      quizAnswers,
      reportData,
      sectionsStatus,
      durationMs,
      resumeRef,
      resumeFilename,
      userName,
      userPhone,
    } = body ?? {};

    if (!formData?.targetPosition) {
      return NextResponse.json({ error: "缺少 formData" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "";

    const hasResume = resumeRef && resumeFilename ? 1 : 0;

    const result = db
      .prepare(
        `INSERT INTO reports
          (created_at, target_position, target_education, target_company, target_city_tier,
           has_resume, resume_filename, sections_status, ip, user_agent, duration_ms,
           user_name, user_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        now,
        formData.targetPosition ?? "",
        formData.targetEducation ?? null,
        formData.targetCompany ?? null,
        formData.targetCityTier ?? null,
        hasResume,
        resumeFilename ?? null,
        sectionsStatus ? JSON.stringify(sectionsStatus) : null,
        ip,
        userAgent,
        durationMs ?? null,
        userName ?? null,
        userPhone ?? null
      );

    const reportId = result.lastInsertRowid as number;

    // Write report JSON
    const reportsDir = path.join(process.cwd(), "data", "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, `${reportId}.json`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ formData, quizAnswers, reportData, sectionsStatus })
    );

    db.prepare("UPDATE reports SET report_storage_path = ? WHERE id = ?").run(
      reportPath,
      reportId
    );

    // Move resume from temp to permanent storage
    if (hasResume && resumeRef && resumeFilename) {
      const srcPath = path.join(
        process.cwd(),
        "data",
        "temp",
        resumeRef,
        resumeFilename
      );
      if (fs.existsSync(srcPath)) {
        const destDir = path.join(
          process.cwd(),
          "data",
          "resumes",
          String(reportId)
        );
        fs.mkdirSync(destDir, { recursive: true });
        const destPath = path.join(destDir, resumeFilename);
        fs.renameSync(srcPath, destPath);
        db.prepare(
          "UPDATE reports SET resume_storage_path = ? WHERE id = ?"
        ).run(destPath, reportId);
        // Clean up empty temp dir
        try {
          fs.rmdirSync(
            path.join(process.cwd(), "data", "temp", resumeRef)
          );
        } catch { /* ignore if not empty */ }
      }
    }

    return NextResponse.json({ reportId });
  } catch (error) {
    console.error("[finalize] error:", error);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
