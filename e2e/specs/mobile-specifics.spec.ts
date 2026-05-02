/**
 * 移动端专项测试
 * 仅在 iPhone 14 (WebKit) 和 Pixel 7 (Chromium) 上运行。
 *
 * 覆盖：
 * 1. input / textarea 的 font-size ≥ 16px（防 iOS 自动缩放）
 * 2. 可交互按钮触控目标宽高（关键文字按钮 ≥ 32px 报错，理想 ≥ 44px）
 * 3. 表单字段 touch 操作可用（page.tap()）
 * 4. 报告页 sticky 导出按钮在滚动到底后仍可见
 */
import { test, expect } from "@playwright/test";
import { HomePage } from "../pages/home.page";
import { FormPage } from "../pages/form.page";
import { QuizPage } from "../pages/quiz.page";
import { LoadingPage } from "../pages/loading.page";

// 只在移动端 project 运行（isMobile 由 Playwright devices 配置自动设置）
test.skip(({ isMobile }) => !isMobile, "仅移动端执行");

const MOBILE_FORM = {
  targetPosition: "数据分析师",
  targetEducation: "本科",
  targetCompany: "阿里",
  targetCityTier: "一线城市",
};

test.describe("移动端专项", () => {
  test("表单 input font-size ≥ 16px（防 iOS 缩放）", async ({ page }) => {
    const home = new HomePage(page);
    await home.gotoStart();
    await expect(page).toHaveURL(/\/form/);

    const smallInputs = await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll("input, textarea")
      ) as HTMLElement[];
      return inputs
        .filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0)
        .map((el) => ({
          id: el.id,
          type: (el as HTMLInputElement).type,
          fontSize: parseFloat(getComputedStyle(el).fontSize),
        }))
        .filter((info) => info.fontSize < 16);
    });

    expect(
      smallInputs,
      `以下 input 的 font-size < 16px，会触发 iOS 缩放：${JSON.stringify(smallInputs)}`
    ).toHaveLength(0);
  });

  test("关键文字按钮触控目标不过小", async ({ page }) => {
    const home = new HomePage(page);
    await home.gotoStart();
    await expect(page).toHaveURL(/\/form/);

    const smallButtons = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll("button")
      ) as HTMLButtonElement[];
      return buttons
        .filter((btn) => {
          const rect = btn.getBoundingClientRect();
          const text = btn.textContent?.trim() ?? "";
          const style = getComputedStyle(btn);
          // 排除纯文字链接式按钮（无背景色、无边框）——这类按钮通常是导航返回链接，
          // 样式上不是真正的"按钮"控件，用户可通过较宽的点击区域操作
          const hasBackground =
            style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
            style.backgroundColor !== "transparent" &&
            style.backgroundColor !== "";
          const hasBorder = parseFloat(style.borderWidth) > 0;
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            !btn.disabled &&
            text.length > 2 && // 有实质文字标签（排除纯图标按钮）
            (hasBackground || hasBorder) && // 只检查有视觉样式的按钮控件
            (rect.width < 32 || rect.height < 32) // 明显过小才报错
          );
        })
        .map((btn) => {
          const rect = btn.getBoundingClientRect();
          return {
            text: btn.textContent?.trim().slice(0, 40),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });
    });

    expect(
      smallButtons,
      `以下按钮触控目标过小：${JSON.stringify(smallButtons)}`
    ).toHaveLength(0);
  });

  test("表单字段支持 touch 操作", async ({ page }) => {
    const home = new HomePage(page);
    await home.gotoStart();
    await expect(page).toHaveURL(/\/form/);

    // tap() 模拟触控，填写意向岗位
    await page.locator("#targetPosition").tap();
    await page.locator("#targetPosition").fill("数据分析师");
    await expect(page.locator("#targetPosition")).toHaveValue("数据分析师");
  });

  test("报告页 sticky 导出按钮在滚动后可见", async ({ page }) => {
    // 移动端全流程（form→quiz→loading→report）比桌面慢，给 3 分钟
    test.setTimeout(180_000);

    const home = new HomePage(page);
    const form = new FormPage(page);
    const quiz = new QuizPage(page);
    const loading = new LoadingPage(page);

    await home.gotoStart();
    await form.fill(MOBILE_FORM);
    await form.submit();
    await quiz.answerAll();
    await loading.skipInterviewAndWaitForReport(120_000);

    await expect(page).toHaveURL(/\/report/);

    // 滚动到页底，等动画完成
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    // sticky 导出按钮应仍然可见（prepare mock 返回后按钮文字变"下载 PDF 报告"）
    const exportBtn = page.getByRole("button", { name: /下载 PDF/ });
    await expect(exportBtn).toBeVisible({ timeout: 15_000 });
  });
});
