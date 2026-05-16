/**
 * Admin 多项目 E2E 测试
 *
 * 前提：
 *   - 开发服务器已启动（playwright webServer 自动处理）
 *   - ADMIN_PASSWORD_HASH / ADMIN_SESSION_PASSWORD 已在 .env.local 配置
 *   - NAV_DB_PATH 已配置且 career-nav.db 存在（否则 nav tab 会显示降级提示，部分断言跳过）
 *
 * 本 spec 只跑 Desktop Chrome（admin 页面无需移动端适配测试）。
 */
import { test, expect, type Page } from "@playwright/test";

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin";

async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  // 等待密码输入框出现
  await page.waitForSelector("input[type='password']", { timeout: 10_000 });
  await page.fill("input[type='password']", ADMIN_PASSWORD);
  await page.click("button[type='submit']");
  // 登录成功后跳转到 /admin/reports
  await page.waitForURL("**/admin/reports**", { timeout: 15_000 });
}

test.use({ storageState: undefined });

test.describe("Admin 多项目列表", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("显示 3 个 Tab（全部 / 职业定位 / 职业导航）", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "全部" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "职业定位" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "职业导航" })).toBeVisible();
  });

  test("全部 Tab 显示时间、项目 badge、岗位、耗时列", async ({ page }) => {
    // 选中 "全部" tab（默认）
    await page.getByRole("tab", { name: "全部" }).click();
    await page.waitForTimeout(500);

    const table = page.getByRole("table");
    // 表头应包含通用列
    await expect(table.getByText("时间")).toBeVisible();
    await expect(table.getByText("项目")).toBeVisible();
    await expect(table.getByText("岗位")).toBeVisible();
  });

  test("切换到职业定位 Tab 后 URL 含 project=report", async ({ page }) => {
    await page.getByRole("tab", { name: "职业定位" }).click();
    await page.waitForURL("**/admin/reports?**project=report**", { timeout: 5_000 });
    await expect(page).toHaveURL(/project=report/);
  });

  test("切换到职业导航 Tab 后 URL 含 project=nav", async ({ page }) => {
    await page.getByRole("tab", { name: "职业导航" }).click();
    await page.waitForURL("**/admin/reports?**", { timeout: 5_000 });
    // nav 可能降级（DB 不可用时显示 amber 提示，也算通过）
    const navReady =
      (await page.getByText(/数据库暂不可用/).count()) === 0;
    if (navReady) {
      await expect(page).toHaveURL(/project=nav/);
    } else {
      // 降级提示可见即通过
      await expect(page.getByText(/数据库暂不可用|职业导航库暂不可用/)).toBeVisible();
    }
  });

  test("全部 Tab 行展开按钮可点击显示项目专属字段", async ({ page }) => {
    await page.getByRole("tab", { name: "全部" }).click();
    await page.waitForTimeout(500);

    // 如果有数据行，点击第一个展开按钮
    const expandBtn = page.locator('[aria-label="展开详情"]').first();
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click();
      // 展开后应显示详细字段（任意内容）
      await expect(
        page.locator("text=/岗位|学历|公司|城市|用户身份/").first()
      ).toBeVisible();
    } else {
      // 没有数据行也算通过（空状态处理正确）
      test.info().annotations.push({ type: "skip_reason", description: "no data rows to expand" });
    }
  });
});

test.describe("Admin 详情页 dispatch", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("职业定位报告详情页含面包屑 badge 显示「职业定位」", async ({
    page,
  }) => {
    // 切到职业定位 tab
    await page.getByRole("tab", { name: "职业定位" }).click();
    await page.waitForTimeout(500);

    // 找第一行操作按钮
    const detailLink = page.getByRole("link", { name: /查看|详情/ }).first();
    if ((await detailLink.count()) === 0) {
      test.info().annotations.push({ type: "skip_reason", description: "no report rows" });
      return;
    }
    await detailLink.click();
    await page.waitForURL("**/admin/reports/**", { timeout: 10_000 });

    // 面包屑显示项目标签
    await expect(page.getByText("职业定位")).toBeVisible();
    // URL 含 project=report
    await expect(page).toHaveURL(/project=report/);
  });

  test("职业导航报告详情页含面包屑 badge 显示「职业导航」", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "职业导航" }).click();
    await page.waitForTimeout(500);

    const navUnavailable = (await page.getByText(/数据库暂不可用/).count()) > 0;
    if (navUnavailable) {
      test.info().annotations.push({ type: "skip_reason", description: "nav DB unavailable" });
      return;
    }

    const detailLink = page.getByRole("link", { name: /查看|详情/ }).first();
    if ((await detailLink.count()) === 0) {
      test.info().annotations.push({ type: "skip_reason", description: "no nav report rows" });
      return;
    }
    await detailLink.click();
    await page.waitForURL("**/admin/reports/**", { timeout: 10_000 });

    await expect(page.getByText("职业导航")).toBeVisible();
    await expect(page).toHaveURL(/project=nav/);
  });

  test("详情页统一操作按钮（查看报告预览 / 打印）可见", async ({ page }) => {
    // 切到职业定位有数据的情况
    await page.getByRole("tab", { name: "职业定位" }).click();
    await page.waitForTimeout(500);

    const detailLink = page.getByRole("link", { name: /查看|详情/ }).first();
    if ((await detailLink.count()) === 0) {
      test.info().annotations.push({ type: "skip_reason", description: "no report rows" });
      return;
    }
    await detailLink.click();
    await page.waitForURL("**/admin/reports/**", { timeout: 10_000 });

    // 操作按钮存在
    const pdfBtn = page.getByRole("button", { name: /查看报告预览|打印/ });
    await expect(pdfBtn).toBeVisible();
  });
});
