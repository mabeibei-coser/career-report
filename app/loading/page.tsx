"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle, AlertTriangle, Sparkles } from "lucide-react";
import {
  generateReport,
  type SectionProgress,
} from "@/lib/report-client";
import { cn } from "@/lib/utils";
import type { JobFormData, QuizAnswer } from "@/lib/types";

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

// 轮播小贴士：长等待时降低焦虑，顺便传递有用信息
const CAREER_TIPS: string[] = [
  "终面前 48 小时完成简历 V3 版本，V2 发给至少 1 位行业前辈过一遍",
  "签约前追问 HR 三件事：具体 Level、直属 leader、是否进轮岗池",
  "薪资谈判前把意向公司同级别员工的总包做一次横向对比",
  "看 offer 要看 base 之外的 package：签字费 / 股票归属 / 年终倍数",
  "脉脉 + 小红书 + 知乎校招话题，三处交叉看近 6 个月帖子做尽调",
  "AI 应用经验能撬动 10-20% 的薪资空间 —— 有成果就敢要",
  "实习成果一定要有数字：活跃从 X → Y、覆盖 N 个客户、节省 Z 小时 / 周",
  "校招季平均每人投 20+ 岗位、进终面 3-5 家，一两次拒绝不说明能力问题",
  "offer 到手别急着签，留 3-5 天做尽调，对比其他 offer 和 package 结构",
  "技能栈分三档写：熟练 / 使用过 / 了解，把核心专长放最前面",
];

/**
 * 轮播职业小贴士：每 4.5 秒切下一条，淡入淡出 + 上移。
 * 初始索引随机，避免每次进页都从第 1 条开始。
 */
function RotatingTips() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * CAREER_TIPS.length));
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % CAREER_TIPS.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative rounded-2xl border border-[var(--blue-200)] bg-gradient-to-br from-white via-[var(--blue-50)]/40 to-white p-4 sm:p-5 overflow-hidden">
      {/* 装饰性渐变条 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--blue-400)] to-transparent" />

      <div className="flex items-start gap-3">
        <div className="shrink-0 size-8 rounded-full bg-gradient-to-br from-[var(--blue-400)] to-[var(--blue-600)] flex items-center justify-center shadow-sm">
          <Sparkles className="size-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[var(--blue-600)] mb-1">
            谨世 · 应届校招小贴士
          </div>
          <div className="relative h-[44px] sm:h-[40px]">
            <AnimatePresence mode="wait">
              <motion.p
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: cubicEase }}
                className="absolute inset-0 text-[13px] sm:text-sm leading-[1.65] text-[var(--navy-800)]"
              >
                {CAREER_TIPS[idx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 进度小点 */}
      <div className="mt-3 flex items-center justify-center gap-1">
        {CAREER_TIPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-0.5 rounded-full transition-all duration-500",
              i === idx
                ? "w-6 bg-[var(--blue-500)]"
                : "w-1.5 bg-[var(--blue-200)]"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoadingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<SectionProgress[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let formData: JobFormData | null = null;
    let quizAnswers: QuizAnswer[] = [];

    try {
      const fd = sessionStorage.getItem("formData");
      const qa = sessionStorage.getItem("quizAnswers");
      if (!fd) {
        router.replace("/form");
        return;
      }
      formData = JSON.parse(fd) as JobFormData;
      if (!formData?.targetPosition) {
        router.replace("/form");
        return;
      }
      quizAnswers = qa ? (JSON.parse(qa) as QuizAnswer[]) : [];
    } catch {
      router.replace("/form");
      return;
    }

    if (!formData) return;

    (async () => {
      try {
        const report = await generateReport(formData, quizAnswers, {
          onProgress: (p) => setProgress(p),
        });
        sessionStorage.setItem("reportData", JSON.stringify(report));
        setDone(true);
        setTimeout(() => router.push("/report"), 700);
      } catch (e) {
        console.error("report generation failed:", e);
        setGlobalError(e instanceof Error ? e.message : "报告生成失败");
      }
    })();
  }, [router]);

  const completedCount = progress.filter(
    (p) => p.status === "completed" || p.status === "fallback" || p.status === "skipped"
  ).length;
  const pct = progress.length > 0 ? (completedCount / progress.length) * 100 : 0;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)]" />
      <div className="fixed inset-0 hero-grid opacity-40" />
      <div className="fixed top-20 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-[var(--blue-200)] to-[var(--blue-100)] opacity-40 blur-3xl" />
      <div className="fixed -bottom-20 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-[var(--blue-300)] to-[var(--blue-100)] opacity-30 blur-3xl" />

      {/* 浮动粒子装饰，增加"正在运算"的空间感 */}
      <FloatingParticles />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: cubicEase }}
          className="mb-6 text-center"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--navy-950)] tracking-tight mb-3">
            正在生成你的定位报告
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            报告分 6 个章节并发生成。前 4 章已在答题期间预热，后 2 章正在进行中。
          </p>
        </motion.div>

        <div className="mb-6">
          <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-2">
            <span>整体进度</span>
            <span>
              {completedCount}/{progress.length || 6}
            </span>
          </div>
          <div className="h-1.5 bg-[var(--blue-100)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-400)]"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: cubicEase }}
            />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-1">
          {progress.map((p) => {
            const isActive = p.status === "loading";
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "relative flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg transition-colors",
                  isActive && "bg-[var(--blue-50)]/70"
                )}
              >
                {/* active 行左侧竖线高亮 */}
                {isActive && (
                  <motion.span
                    layoutId="active-bar"
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-[var(--blue-400)] to-[var(--blue-600)]"
                    transition={{ duration: 0.3, ease: cubicEase }}
                  />
                )}
                <StatusIcon status={p.status} />
                <div className="flex-1 min-w-0 flex items-center flex-wrap gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-[var(--navy-800)]">
                    {p.label}
                  </span>
                  {p.dataSource && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-mono text-[10px] rounded px-1.5 py-0.5 border transition-colors",
                        isActive
                          ? "border-[var(--blue-300)] bg-white text-[var(--blue-700)]"
                          : "border-[var(--blue-100)] bg-[var(--blue-50)]/60 text-[var(--navy-600)]"
                      )}
                    >
                      <span
                        className={cn(
                          "size-1 rounded-full bg-emerald-500 shrink-0",
                          isActive && "animate-pulse"
                        )}
                      />
                      {p.dataSource}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                  {shortStatusText(p.status)}
                </span>
              </motion.div>
            );
          })}
          {progress.length === 0 && (
            <div className="flex items-center gap-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在准备章节生成…
            </div>
          )}
        </div>

        {/* 轮播小贴士 —— 缓解长等待焦虑 */}
        <div className="mt-5">
          <RotatingTips />
        </div>

        {globalError && (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <div className="font-medium text-destructive mb-1">
                报告生成过程中出错
              </div>
              <div className="text-xs text-muted-foreground">{globalError}</div>
            </div>
          </div>
        )}

        {done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center text-sm text-emerald-600"
          >
            <CheckCircle2 className="mx-auto mb-2 size-6" />
            报告已生成，正在跳转…
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SectionProgress["status"] }) {
  if (status === "completed")
    return <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />;
  if (status === "fallback")
    return <AlertTriangle className="size-5 text-amber-500 shrink-0" />;
  if (status === "skipped")
    return <Circle className="size-5 text-muted-foreground shrink-0" />;
  if (status === "loading")
    return <Loader2 className="size-5 animate-spin text-[var(--blue-500)] shrink-0" />;
  return <Circle className="size-5 text-muted-foreground/50 shrink-0" />;
}

function shortStatusText(status: SectionProgress["status"]): string {
  switch (status) {
    case "pending":
      return "等待中";
    case "loading":
      return "生成中";
    case "completed":
      return "已完成";
    case "fallback":
      return "已兜底";
    case "skipped":
      return "已跳过";
    default:
      return "";
  }
}

/**
 * 浮动粒子装饰：随机点位 + 慢速上浮 + 透明度循环，做"数据运算中"的空间感。
 * 纯装饰，pointer-events-none。
 */
function FloatingParticles() {
  const [dots, setDots] = useState<Array<{ x: number; y: number; delay: number; dur: number }>>([]);
  useEffect(() => {
    const arr = Array.from({ length: 14 }, () => ({
      x: Math.random() * 100,
      y: 60 + Math.random() * 40,
      delay: Math.random() * 4,
      dur: 8 + Math.random() * 6,
    }));
    setDots(arr);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute size-1 rounded-full bg-[var(--blue-400)]/30"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
          initial={{ y: 0, opacity: 0 }}
          animate={{
            y: -140,
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: d.dur,
            delay: d.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
