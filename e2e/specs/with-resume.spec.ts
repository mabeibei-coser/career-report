/**
 * 带简历的全链路测试
 * 在 full-flow.spec.ts 的基础上，在表单步骤上传简历（PDF），
 * 验证「简历诊断」章节被渲染（共 6 个章节）。
 *
 * E2E_MOCK_MODE：/api/resume/parse 返回 fixture 文本（128 字），
 * /api/report/resume-diagnosis 返回 resumeDiagnosisMock。
 */
import { test, expect } from "@playwright/test";
import { HomePage } from "../pages/home.page";
import { FormPage } from "../pages/form.page";
import { QuizPage } from "../pages/quiz.page";
import { LoadingPage } from "../pages/loading.page";
import { ReportPage } from "../pages/report.page";

const FORM_WITH_RESUME = {
  targetPosition: "产品经理",
  targetEducation: "本科",
  targetCompany: "腾讯",
  targetCityTier: "一线城市",
};

test.describe("全链路（带简历）", () => {
  test("上传 PDF 简历 → 报告含简历诊断章节", async ({ page }) => {
    const home = new HomePage(page);
    const form = new FormPage(page);
    const quiz = new QuizPage(page);
    const loading = new LoadingPage(page);
    const report = new ReportPage(page);

    await home.gotoStart();

    // 填意向 + 上传简历
    await form.fill(FORM_WITH_RESUME);
    await form.uploadResume("test-resume.pdf");
    await form.submit();

    await expect(page).toHaveURL(/\/quiz/);
    await quiz.answerAll();
    await expect(page).toHaveURL(/\/interview/);

    await loading.skipInterviewAndWaitForReport();
    await expect(page).toHaveURL(/\/report/);

    // 有简历 → 8 个 data-pdf-section（header + 6 章节含 resumeDiagnosis + disclaimer）
    await report.assertSectionsPresent(8);
  });
});
