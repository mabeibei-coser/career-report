import type { Page } from "@playwright/test";

export class QuizPage {
  constructor(private page: Page) {}

  /**
   * 依次回答 6 道测评题（每题选第一个选项 A），
   * 最后点击「进入 AI 访谈」，等待跳转到 /interview。
   *
   * Q1、Q2 为静态题目，选项立即可用。
   * Q3-Q6 在 E2E_MOCK_MODE 下通过 /api/quiz/generate 即时返回，
   * 页面会用 `div.grid.gap-3 > button` 渲染选项按钮。
   */
  async answerAll() {
    for (let i = 0; i < 6; i++) {
      // 等待当前题的选项按钮出现（Q3-Q6 可能有短暂加载占位）
      await this.page
        .locator("div.grid.gap-3 > button")
        .first()
        .waitFor({ state: "visible", timeout: 20_000 });

      // 点选项 A（第一个按钮）
      await this.page.locator("div.grid.gap-3 > button").first().click();

      if (i < 5) {
        await this.page.getByRole("button", { name: "下一题" }).click();
      } else {
        // 第 6 题答完后「进入 AI 访谈」按钮变为可点击
        await this.page.getByRole("button", { name: "进入 AI 访谈" }).click();
        await this.page.waitForURL("**/interview");
      }
    }
  }
}
