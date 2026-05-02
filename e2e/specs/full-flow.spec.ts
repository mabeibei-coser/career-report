/**
 * 全链路 happy path
 * 覆盖 Desktop Chrome / iPhone 14 (WebKit) / Pixel 7 (Chromium)
 *
 * 流程：首页 → /form（无简历）→ /quiz → /interview（跳过）→ /loading → /report
 * E2E_MOCK_MODE=true：所有 LLM API 即时返回 mock 数据，不消耗 API 额度
 */
import { test, expect } from "@playwright/test";
import { HomePage } from "../pages/home.page";
import { FormPage } from "../pages/form.page";
import { QuizPage } from "../pages/quiz.page";
import { LoadingPage } from "../pages/loading.page";
import { ReportPage } from "../pages/report.page";

const DEFAULT_FORM = {
  targetPosition: "产品经理",
  targetEducation: "本科",
  targetCompany: "字节跳动",
  targetCityTier: "一线城市",
};

test.describe("全链路（无简历）", () => {
  test("首页 → 表单 → 测评 → 报告", async ({ page }) => {
    const home = new HomePage(page);
    const form = new FormPage(page);
    const quiz = new QuizPage(page);
    const loading = new LoadingPage(page);
    const report = new ReportPage(page);

    // 1. 首页
    await home.gotoStart();
    await expect(page).toHaveURL(/\/form/);

    // 2. 表单：4 个意向字段，不上传简历
    await form.fill(DEFAULT_FORM);
    await form.submit();
    await expect(page).toHaveURL(/\/quiz/);

    // 3. 快测：6 道题全部答完
    await quiz.answerAll();
    await expect(page).toHaveURL(/\/interview/);

    // 4. 跳过访谈 → 等报告生成
    await loading.skipInterviewAndWaitForReport();
    await expect(page).toHaveURL(/\/report/);

    // 5. 验证 7 个 data-pdf-section 元素（header + 5 章节 + disclaimer；无简历故无 resumeDiagnosis）
    await report.assertSectionsPresent(7);
  });
});
