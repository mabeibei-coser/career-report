@AGENTS.md

# AI 职业定位报告

## 项目概述
社保局职业咨询辅助工具。流程：上传简历/手动填写 → AI 访谈（文字/语音）→ 等待动画 → 生成报告。

## 技术栈
- Next.js + TypeScript + Tailwind CSS + shadcn/ui
- Recharts（图表）+ Framer Motion（动画）
- MiniMax API（AI 模型，通过 OpenAI SDK 兼容调用）
- MiniMax TTS API（语音合成，speech-02-turbo）
- Web Speech API（浏览器语音识别）
- React Hook Form + Zod（表单验证）
- pdf-parse / mammoth / word-extractor（简历文本提取）

## 设计规范
- 风格：专业商务，简洁大气
- 主色：蓝色系（浅色背景）
- 字体：系统中文字体
- 优先桌面端

## 项目结构
```
app/
  page.tsx              → 首页
  form/page.tsx         → 信息填写（简历上传 + 手动填写双路径）
  interview/page.tsx    → AI 访谈（文字/语音模式）
  loading/page.tsx      → 等待动画
  report/page.tsx       → 报告展示
  api/interview/        → AI 访谈 API（SSE 流式）
  api/interview/tts/    → TTS 语音合成 API
  api/report/           → 报告生成 API
  api/resume/parse/     → 简历解析 API
components/
  ui/                   → shadcn 组件
  layout/               → 布局组件
  form/                 → 表单组件
  interview/            → 访谈组件（MicButton, VoiceInput, ModeToggle）
  loading/              → 加载动画组件
  report/               → 报告组件
lib/
  minimax.ts            → MiniMax API 封装（Chat + TTS）
  resume-parser.ts      → 简历文本提取（PDF/DOCX/DOC）
  form-options.ts       → 表单选项常量
  types.ts              → 类型定义
docs/
  PRD.md                → 需求文档
```

## 开发规则
- 每个页面用 /frontend-design skill 确保设计质量
- 组件用 shadcn/ui，不手写基础组件
- API 路由放 app/api/ 下
- 环境变量放 .env.local
