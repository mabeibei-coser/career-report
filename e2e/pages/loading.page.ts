import type { Page } from "@playwright/test";

export class LoadingPage {
  constructor(private page: Page) {}

  /**
   * 若当前在 /interview，先跳过访谈（点「跳过访谈」→ 确认弹窗「跳过」），
   * 然后等待报告生成完成并跳转到 /report。
   *
   * E2E_MOCK_MODE 下所有 section API 即时返回，通常 3-5 秒内完成。
   */
  async skipInterviewAndWaitForReport(timeout = 90_000) {
    if (this.page.url().includes("/interview")) {
      // 点「跳过访谈」按钮
      await this.page.getByRole("button", { name: /跳过访谈/ }).click();
      // 确认弹窗：点「跳过」
      await this.page.getByRole("button", { name: /^跳过$/ }).click();
    }
    // 等 /loading 自动跳 /report
    await this.page.waitForURL("**/report", { timeout });
  }
}
