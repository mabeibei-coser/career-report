@AGENTS.md

# AI 职业定位报告

## 项目概述
面向**应届大学生**的校招定位工具。流程：求职意向 + 简历（选填）→ 6 题 AI 快测 → 6 章节定位报告（按章节并发生成，按 section 分页导出 PDF）。

## 技术栈
- Next.js 16 + TypeScript + Tailwind CSS v4 + shadcn/ui（@base-ui/react）
- Recharts（图表：柱状、雷达、进度）+ Framer Motion（动画）
- MiniMax API（报告与测评题生成，OpenAI SDK 兼容）
- pdf-parse + mammoth（服务端解析 PDF / DOCX 简历）
- React Hook Form + Zod（表单验证）
- html2canvas-pro + jsPDF（按 section 分页导出 PDF）

## 设计规范
- 风格：专业商务 + 校招友好，简洁大气
- 主色：蓝色系（浅色背景）
- 字体：系统中文字体（PingFang SC / Microsoft YaHei）
- **桌面 + 移动双端优先**；触控目标 ≥ 44×44；iOS 文本 input font-size ≥ 16px

## 项目结构
```
app/
  page.tsx                              → 首页
  form/page.tsx                         → 第 1 步：4 字段意向 + 简历上传
  quiz/page.tsx                         → 第 2 步：6 题快测
  interview/page.tsx                    → 旧路径，重定向到 /quiz
  loading/page.tsx                      → 基于真实 section 进度的加载页
  report/page.tsx                       → 第 3 步：6 章节报告装配层
  layout.tsx                            → 含 viewport 配置
  api/
    resume/parse/route.ts               → 简历解析（PDF/DOCX → 文本）
    quiz/generate/route.ts              → 6 题 AI 快测生成
    report/
      overview/route.ts                 → 1. 总览
      salary/route.ts                   → 2. 岗位薪资（锚点注入 + 城市系数后端合成）
      position-info/route.ts            → 3. 岗位信息（3 细分 + 能力雷达）
      resume-diagnosis/route.ts         → 4. 简历诊断（无简历返回 null）
      negotiation/route.ts              → 5. 谈薪要点
      workplace-insight/route.ts        → 6. 职场环境透视
components/
  ui/                                   → shadcn 基础 + 自建 file-upload
  report/
    report-context.tsx                  → exporting context
    section-wrapper.tsx                 → 通用 Section（data-pdf-section）
    overview-section.tsx
    salary-section.tsx
    position-info-section.tsx
    resume-diagnosis-section.tsx
    negotiation-section.tsx
    development-section.tsx
    workplace-insight-section.tsx
    export-actions.tsx                  → 底部 Sticky 下载 / 打印
lib/
  minimax.ts                            → MiniMax OpenAI 兼容客户端
  report-shared.ts                      → buildBaseContext / callMiniMaxJson 等共享工具
  report-client.ts                      → 前端并发调度 6 个 section API
  pdf-export.ts                         → 按 section 分页 PDF 导出
  salary-anchors.ts                     → 应届起薪锚点 + 城市系数
  form-options.ts                       → 学历 / 城市能级枚举
  mocks/report-mocks.ts                 → 每 section 的兜底数据
  types.ts                              → 类型定义
```

## 开发规则
- 每个页面用 /frontend-design skill 确保设计质量
- 组件用 shadcn/ui（@base-ui/react），不手写基础组件
- API 路由放 app/api/ 下；**所有 section API 独立**，失败互不影响
- 环境变量放 .env.local（模板见 `.env.local.example`）：
  - `MINIMAX_API_KEY` / `MINIMAX_BASE_URL` / `MINIMAX_MODEL`（默认 MiniMax-M1，生产为 minimax2.7）
  - `IFLYTEK_API_KEY`（必填以启用讯飞；**留空则自动降级回 MiniMax**）/ `IFLYTEK_BASE_URL`（默认 `https://maas-coding-api.cn-huabei-1.xf-yun.com/v2`）/ `IFLYTEK_MODEL`（默认 `astron-code-latest`）
  - 讯飞作用：6 题快测生成的**主模型**（MiniMax 仅兜底）；salary 章节 MiniMax 失败时的 **fallback**
- 新增 Node 包（pdf-parse、mammoth）需在 `next.config.ts` 的 `serverExternalPackages` 中登记
- 报告内容红线：
  - **职场环境透视**：绝不点名具体公司，只做行业/类型共性
  - **谈薪要点**：禁止建议伪造经历、购买实习证明等造假行为；只提合法积累路径

## 移动端测试规则
- **每次交付前必须跑 `npm run test:e2e:mobile` 并通过**（桌面端用 `npm run test:e2e`）
- 测试用 E2E_MOCK_MODE=true（webServer 自动注入），不消耗 LLM API 额度
- 真机 USB 调试指南见 `docs/mobile-testing.md`

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate,
/document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard,
/unfreeze, /gstack-upgrade, /learn.

## Skill routing

When the user's request matches one of the situations below, invoke the listed skill via the Skill tool. When in doubt between multiple, invoke the skill rather than answer freehand. Full 分工矩阵见 `~/.claude/skills/INDEX.md` `## 分工矩阵` 节。

### 计划 / 起步
- 产品想法、头脑风暴、起步框架 → `/office-hours`
- 计划做 CEO 视角审查（10 星 / scope） → `/plan-ceo-review`
- 计划做工程视角审查（架构 / 边界 / 测试） → `/plan-eng-review`
- 计划做设计视角审查（0-10 评分） → `/plan-design-review`
- 一键跑完 CEO + 设计 + 工程 + DX → `/autoplan`

### 设计
- 找设计灵感（"参考 XX 风格"） → `qiaomu-design-advisor`
- 看多个 AI 设计变体对比挑 → `/design-shotgun`
- 决定风格后做新页面/组件 → `frontend-design`（默认）或 `taste-skill` / `soft-skill` / `minimalist-skill`
- 跑起来做视觉 QA → `/design-review`（动态实跑）+ `redesign-skill`（静态代码审计）
- 落成 production HTML/CSS → `/design-html`

### 调试 / 审查
- 新 bug 不在 17 个 bug 笔记覆盖范围 → `/investigate`
- 跨模型独立第二意见 → `/codex review` 或 `/codex challenge`
- PR 合入前的 staff engineer 审查 → `/review`
- 基础设施级安全审计 → `/cso`

### 测试
- QA 测试 + 修 bug 闭环 → `/qa`
- 只测不修，给报告 → `/qa-only`
- 打开 URL 测某个流程 → `/browse`
- 测带登录的页面 → 先 `/setup-browser-cookies` 再 `/qa`

### 部署
- career-report 直推腾讯云（不走 PR） → `career-report-deploy`
- 走 GitHub PR 流程 → `/ship` → `/land-and-deploy` → `/canary`
- 发版后同步 README / CHANGELOG / CLAUDE.md → `/document-release`

### 上下文 / 知识
- 切走前保存当前工作状态 → `/context-save`
- 回来时恢复 → `/context-restore`
- 把这次的踩坑变成持久 skill → `claudeception`
- 看本 repo 在 gstack 里积累的经验 → `/learn`
