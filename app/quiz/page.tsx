"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/ui/step-indicator";
import { cn } from "@/lib/utils";
import { consumeQuizPrefetch } from "@/lib/quiz-prefetch";
import { pickStaticQ1, pickStaticQ2, PLACEHOLDER_Q3_TO_Q6, STATIC_FALLBACK_Q3_TO_Q6 } from "@/lib/quiz-skeleton";
import type {
  JobFormData,
  QuizAnswer,
  QuizQuestion,
  QuizDimension,
} from "@/lib/types";

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface SelectionMap {
  [questionId: string]: "A" | "B" | "C" | "D";
}

// Synchronously read formData from sessionStorage so static Q1 can render on first paint
function readInitialQuizState(): {
  formData: JobFormData | null;
  questions: QuizQuestion[];
  selections: SelectionMap;
  quizLoading: boolean;
} {
  if (typeof window === "undefined") {
    return { formData: null, questions: [], selections: {}, quizLoading: true };
  }
  try {
    const saved = sessionStorage.getItem("formData");
    if (!saved) {
      return { formData: null, questions: [], selections: {}, quizLoading: true };
    }
    const parsed = JSON.parse(saved) as JobFormData;
    if (!parsed.targetPosition) {
      return { formData: null, questions: [], selections: {}, quizLoading: true };
    }
    const staticQ1 = pickStaticQ1();
    const staticQ2 = pickStaticQ2();
    const initialQuestions = [staticQ1, staticQ2, ...PLACEHOLDER_Q3_TO_Q6];
    let initialSelections: SelectionMap = {};
    const savedAnswers = sessionStorage.getItem("quizAnswers");
    if (savedAnswers) {
      try {
        const answers = JSON.parse(savedAnswers) as QuizAnswer[];
        const map: SelectionMap = {};
        for (const a of answers) {
          map[a.questionId] = a.selectedKey;
        }
        initialSelections = map;
      } catch {}
    }
    return {
      formData: parsed,
      questions: initialQuestions,
      selections: initialSelections,
      quizLoading: false,
    };
  } catch {
    return { formData: null, questions: [], selections: {}, quizLoading: true };
  }
}

export default function QuizPage() {
  const router = useRouter();
  const initialState = readInitialQuizState();
  const [formData] = useState<JobFormData | null>(initialState.formData);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialState.questions);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selections, setSelections] = useState<SelectionMap>(initialState.selections);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quizLoading, setQuizLoading] = useState(initialState.quizLoading);

  // 后台拉取个性化题目（formData 已在 initializer 中读取）
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!formData) {
      router.replace("/form");
      return;
    }
    // 后台预编译 /interview 路由（dev 模式消除首次跳转的"Compiling..."等待）
    router.prefetch("/interview");
    const parsed = formData;
    try {
      // 后台异步拉取 Q3-Q6 个性化题目（Q1+Q2 已从题库静态展示）
      (async () => {
        try {
          const prefetched = consumeQuizPrefetch(parsed);
          let q3to6: QuizQuestion[] | null = null;

          // 优先消费预拉取（最多等 8s）
          if (prefetched) {
            try {
              q3to6 = await Promise.race([
                prefetched.promise.then((d) => d.questions),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("prefetch timeout")), 8000)
                ),
              ]);
            } catch { /* 超时/失败 */ }
          }

          // 预拉取没结果 → 现场 fetch from=3（最多 8s）
          if (!q3to6) {
            try {
              const ctrl = new AbortController();
              const tid = setTimeout(() => ctrl.abort(), 8000);
              const res = await fetch("/api/quiz/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ formData: parsed, from: 3 }),
                signal: ctrl.signal,
              });
              clearTimeout(tid);
              const data = await res.json();
              if (res.ok && data.questions?.length) {
                q3to6 = data.questions as QuizQuestion[];
              }
            } catch { /* fetch 超时/失败 */ }
          }

          if (q3to6?.length) {
            setQuestions((prev) => [prev[0], prev[1], ...q3to6!]);
            return;
          }

          // 全部失败 → 客户端静态兜底 Q3-Q6
          console.warn("[quiz] all fetch failed, using client fallback Q3-Q6");
          setQuestions((prev) => [prev[0], prev[1], ...STATIC_FALLBACK_Q3_TO_Q6]);
        } catch (e) {
          console.warn("[quiz] unexpected error in background fetch:", e);
        }
      })();
    } catch (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadError(e instanceof Error ? e.message : "加载失败");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuizLoading(false);
    }
  }, [router, formData]);

  const currentQ = questions[currentIdx];
  const selectedKey = currentQ ? selections[currentQ.id] : undefined;

  const handleSelect = (key: "A" | "B" | "C" | "D") => {
    if (!currentQ) return;
    const updated = { ...selections, [currentQ.id]: key };
    setSelections(updated);
    persistAnswers(updated);
  };

  const persistAnswers = (map: SelectionMap) => {
    const answers: QuizAnswer[] = questions
      .filter((q) => map[q.id])
      .map((q) => {
        const key = map[q.id]!;
        const opt = q.options.find((o) => o.key === key);
        return {
          questionId: q.id,
          dimension: q.dimension as QuizDimension,
          selectedKey: key,
          questionText: q.question,
          selectedLabel: opt?.label ?? "",
        };
      });
    sessionStorage.setItem("quizAnswers", JSON.stringify(answers));
  };

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };
  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => selections[q.id]);

  const handleFinish = () => {
    if (!allAnswered) return;
    persistAnswers(selections);
    sessionStorage.removeItem("reportData");
    router.push("/interview");
  };

  if (quizLoading) {
    return null; // formData 缺失时 useEffect 会 redirect 到 /form
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)] px-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="mx-auto size-10 text-destructive" />
          <div className="text-lg font-medium">测评加载失败</div>
          <div className="text-sm text-muted-foreground">{loadError}</div>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => router.push("/form")}>
              返回填写信息
            </Button>
            <Button onClick={() => window.location.reload()}>重新加载</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;
  const progressPct = ((currentIdx + 1) / questions.length) * 100;
  const answeredCount = Object.keys(selections).length;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)]" />
      <div className="fixed inset-0 hero-grid opacity-40" />
      <div className="fixed top-20 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-[var(--blue-200)] to-[var(--blue-100)] opacity-40 blur-3xl" />
      <div className="fixed -bottom-20 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-[var(--blue-300)] to-[var(--blue-100)] opacity-30 blur-3xl" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-[max(6rem,env(safe-area-inset-bottom))]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: cubicEase }}
          className="mb-6"
        >
          <StepIndicator currentStep={1} compact className="mb-4" />
          <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-2">
            <span>
              第 {currentIdx + 1} / {questions.length} 题
            </span>
            <span>已完成 {answeredCount} / {questions.length}</span>
          </div>
          <div className="h-1.5 bg-[var(--blue-100)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-400)]"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: cubicEase }}
            />
          </div>
        </motion.div>

        {/* Question card — nav 按钮放在 AnimatePresence 外，切题时保持稳定不闪 */}
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22, ease: cubicEase }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="shrink-0 size-8 sm:size-9 rounded-full bg-[var(--blue-500)] text-white flex items-center justify-center text-sm font-semibold">
                  Q{currentIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                    {currentQ.dimension}
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold leading-relaxed text-[var(--navy-900)]">
                    {currentQ.question}
                  </h2>
                </div>
              </div>

              {/* Options */}
              {currentQ.options.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="size-8 animate-spin text-blue-400" />
                  <p className="text-sm text-blue-200/60">AI 正在为你定制此题，约 3-8 秒...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {currentQ.options.map((opt) => {
                    const active = selectedKey === opt.key;
                    return (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => handleSelect(opt.key)}
                        className={cn(
                          "group flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
                          "min-h-[52px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-500)]/40",
                          active
                            ? "border-[var(--blue-500)] bg-[var(--blue-500)]/5 shadow-sm"
                            : "border-[var(--blue-100)] bg-white/70 hover:border-[var(--blue-300)] hover:bg-white"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                            active
                              ? "border-[var(--blue-500)] bg-[var(--blue-500)] text-white"
                              : "border-[var(--blue-200)] text-[var(--navy-700)]"
                          )}
                        >
                          {active ? <CheckCircle2 className="size-4" /> : opt.key}
                        </div>
                        <div className="flex-1 text-sm sm:text-base leading-relaxed text-[var(--navy-800)]">
                          {opt.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav — 放在 AnimatePresence 外，切题不受影响，按钮稳定可见 */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="h-10 px-4"
            >
              上一题
            </Button>
            {currentIdx < questions.length - 1 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={!selectedKey || currentQ.options.length === 0}
                className="h-10 px-6 bg-[var(--blue-500)] hover:bg-[var(--blue-600)]"
              >
                下一题
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={!allAnswered}
                className="h-10 px-6 bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white"
              >
                进入 AI 访谈
              </Button>
            )}
          </div>
        </div>

        {/* Tips */}
        <p className="text-center text-xs text-[var(--muted-foreground)] mt-6">
          测评无对错，凭直觉作答即可；已作答会自动保存，刷新不丢失。
          {formData?.resumeText && (
            <span className="ml-1">
              · 已识别简历（{formData.resumeFileName}）
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

