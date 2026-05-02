/**
 * PDF 导出测试
 * 仅在 Desktop Chrome 运行（DownloadPDFButton 走服务端 Puppeteer；WebKit/Mobile 行为不同）。
 * iOS WebKit 导出行为请在真机上抽查，参见 docs/mobile-testing.md。
 *
 * 测试策略：
 *   - E2E_MOCK_MODE 下 /api/report/pdf/prepare 直接返回固定 token，
 *     /api/report/pdf?token=e2e-mock-pdf-token 返回最小合法 PDF，不启动 Puppeteer。
 *   - page.addInitScript 拦截 window.open → null，强制走 window.location.href 降级路径，
 *     这样 page.waitForEvent("download") 能可靠捕获（无需 popup / context 级监听）。
 */
import { test, expect } from "@playwright/test";
import { HomePage } from "../pages/home.page";
import { FormPage } from "../pages/form.page";
import { QuizPage } from "../pages/quiz.page";
import { LoadingPage } from "../pages/loading.page";
import { ReportPage } from "../pages/report.page";

// 只在 Desktop Chrome 跑（避免 WebKit/Mobile 的下载行为差异）
test.skip(({ browserName, isMobile }) => isMobile || browserName !== "chromium", "仅 Desktop Chrome");

test.describe("PDF 导出", () => {
  test("点击「下载 PDF」触发文件下载", async ({ page }) => {
    // 全流程（form→quiz→loading→report）最多需 ~2min；给 3min
    test.setTimeout(180_000);

    // 拦截 window.open → null，强制 DownloadPDFButton 走 window.location.href 降级路径。
    // 在 headless Chrome 里 window.open 打开的 popup 收到 Content-Disposition:attachment
    // 时会走 PDF viewer 而非触发 download 事件；降级到同标签页导航则行为可靠。
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).open = () => null;
    });

    const home = new HomePage(page);
    const form = new FormPage(page);
    const quiz = new QuizPage(page);
    const loading = new LoadingPage(page);
    const report = new ReportPage(page);

    // 先跑完整流程到达报告页
    await home.gotoStart();
    await form.fill({
      targetPosition: "产品经理",
      targetEducation: "本科",
      targetCompany: "美团",
      targetCityTier: "一线城市",
    });
    await form.submit();
    await quiz.answerAll();
    await loading.skipInterviewAndWaitForReport();
    await expect(page).toHaveURL(/\/report/);
    await report.assertSectionsPresent(7);

    // 监听 download 事件（page 级：window.location.href 降级路径触发的下载在当前页）
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await report.clickExportPDF();
    const download = await downloadPromise;

    // 文件名应包含 .pdf
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    // 验证文件体积 > 0（说明 PDF 确实被生成）
    const path = await download.path();
    if (path) {
      const { statSync } = await import("fs");
      const stat = statSync(path);
      expect(stat.size).toBeGreaterThan(0);
    }
  });
});
