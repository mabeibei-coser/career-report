import type { Page } from "@playwright/test";

export interface FormFillData {
  targetPosition: string;
  targetEducation: string;
  targetCompany: string;
  targetCityTier: string;
}

export class FormPage {
  constructor(private page: Page) {}

  /** 填写 4 个必填意向字段 */
  async fill(data: FormFillData) {
    await this.page.locator("#targetPosition").fill(data.targetPosition);
    await this.page.locator("#targetCompany").fill(data.targetCompany);

    // @base-ui/react Select：点 trigger → 等 popup 弹出 → 点选项
    await this.page.locator("#targetEducation").click();
    await this.page
      .getByRole("option", { name: data.targetEducation, exact: true })
      .click();

    await this.page.locator("#targetCityTier").click();
    await this.page
      .getByRole("option", { name: data.targetCityTier, exact: true })
      .click();
  }

  /**
   * 上传简历（模拟 PDF）。
   * E2E_MOCK_MODE 下 /api/resume/parse 直接返回 fixture 文本，无需真实 PDF。
   */
  async uploadResume(fileName = "test-resume.pdf") {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      // 极小的占位内容，实际解析在 mock 模式下被跳过
      buffer: Buffer.from("%PDF-1.4 E2E test resume placeholder"),
    });
    // 等待上传组件显示「已解析」
    await this.page.getByText("已解析").waitFor({ timeout: 15_000 });
  }

  /** 提交表单，等待跳转到 /quiz */
  async submit() {
    await this.page.getByRole("button", { name: "下一步" }).click();
    await this.page.waitForURL("**/quiz");
  }
}
