import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class ReportPage {
  constructor(private page: Page) {}

  /**
   * 断言报告页 [data-pdf-section] 元素数量。
   * 报告页固定有 header + disclaimer 2 个直接带属性的容器，
   * 加上 API 章节（SectionWrapper 各贡献 1 个）：
   *   无简历：7 = 2 固定 + 5 章节（overview/salary/positionInfo/negotiation/workplace）
   *   有简历：8 = 2 固定 + 6 章节（多 resumeDiagnosis）
   */
  async assertSectionsPresent(expectedCount: 7 | 8 = 7) {
    await expect(
      this.page.locator("[data-pdf-section]")
    ).toHaveCount(expectedCount, { timeout: 10_000 });
  }

  /** 断言指定 data-pdf-section 值的章节可见 */
  async assertSection(sectionId: string) {
    await expect(
      this.page.locator(`[data-pdf-section="${sectionId}"]`)
    ).toBeVisible();
  }

  /** 点击导出 PDF 按钮（等待 DownloadPDFButton 完成 prepare、进入 ready 状态） */
  async clickExportPDF() {
    // DownloadPDFButton: "准备下载链接…" → "下载 PDF 报告"（ready）
    const btn = this.page.getByRole("button", { name: /下载 PDF/ });
    await btn.waitFor({ state: "visible", timeout: 15_000 });
    await btn.click();
  }
}
