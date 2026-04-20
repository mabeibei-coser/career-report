"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Pause, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { consumeQuizPrefetch } from "@/lib/quiz-prefetch";
import type {
  JobFormData,
  QuizAnswer,
  QuizQuestion,
  QuizDimension,
} from "@/lib/types";

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

type TTSStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface SelectionMap {
  [questionId: string]: "A" | "B" | "C" | "D";
}

export default function QuizPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<JobFormData | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selections, setSelections] = useState<SelectionMap>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quizLoading, setQuizLoading] = useState(true);

  const [ttsStatus, setTtsStatus] = useState<TTSStatus>("idle");
  const [ttsDisabled, setTtsDisabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Load form data and fetch quiz
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem("formData");
      if (!saved) {
        router.replace("/form");
        return;
      }
      const parsed = JSON.parse(saved) as JobFormData;
      if (!parsed.targetPosition) {
        router.replace("/form");
        return;
      }
      setFormData(parsed);

      // Restore existing selections
      const savedAnswers = sessionStorage.getItem("quizAnswers");
      if (savedAnswers) {
        try {
          const answers = JSON.parse(savedAnswers) as QuizAnswer[];
          const map: SelectionMap = {};
          for (const a of answers) {
            map[a.questionId] = a.selectedKey;
          }
          setSelections(map);
        } catch {}
      }

      // Fetch quiz —— 优先消费表单页提交时的预拉取结果
      (async () => {
        try {
          const prefetched = consumeQuizPrefetch(parsed);
          if (prefetched) {
            const data = await prefetched.promise;
            setQuestions(data.questions);
          } else {
            const res = await fetch("/api/quiz/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ formData: parsed }),
            });
            const data = await res.json();
            if (!res.ok || !data.questions) {
              throw new Error(data.error ?? "测评题获取失败");
            }
            setQuestions(data.questions);
          }
        } catch (e) {
          setLoadError(e instanceof Error ? e.message : "无法加载测评题");
        } finally {
          setQuizLoading(false);
        }
      })();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败");
      setQuizLoading(false);
    }
  }, [router]);

  const currentQ = questions[currentIdx];
  const selectedKey = currentQ ? selections[currentQ.id] : undefined;

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setTtsStatus("idle");
  }, []);

  const playTTS = useCallback(
    async (text: string) => {
      if (ttsDisabled || !text) return;
      stopAudio();
      setTtsStatus("loading");
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `TTS 服务不可用 (${res.status})`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const audio = audioRef.current;
        audio.src = url;
        audio.onplay = () => setTtsStatus("playing");
        audio.onpause = () => {
          if (!audio.ended) setTtsStatus("paused");
        };
        audio.onended = () => setTtsStatus("idle");
        audio.onerror = () => setTtsStatus("error");
        await audio.play();
      } catch (e) {
        console.warn("[quiz] TTS failed:", e);
        setTtsStatus("error");
        // First failure: stay enabled but show hint. Keep trying on user click.
      }
    },
    [stopAudio, ttsDisabled]
  );

  // Stop audio on unmount / question switch
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  useEffect(() => {
    // When switching question, stop old audio
    stopAudio();
  }, [currentIdx, stopAudio]);

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
    stopAudio();
    persistAnswers(selections);
    sessionStorage.removeItem("reportData");
    router.push("/loading");
  };

  if (quizLoading) {
    return <QuizLoadingScreen />;
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
          <div className="flex items-center gap-3 mb-4">
            <Badge
              variant="secondary"
              className="bg-[var(--blue-500)] text-white px-3 py-1 text-xs font-medium tracking-wide"
            >
              第 2 步 / 共 3 步
            </Badge>
            <span className="text-sm text-[var(--muted-foreground)]">
              职业性格 6 题快测
            </span>
          </div>
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

              {/* TTS player */}
              {!ttsDisabled && (
                <div className="flex items-center gap-2 mb-5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      ttsStatus === "playing"
                        ? audioRef.current?.pause()
                        : playTTS(currentQ.ttsText || currentQ.question)
                    }
                    disabled={ttsStatus === "loading"}
                    className="h-9 min-w-[110px] gap-1.5"
                  >
                    {ttsStatus === "loading" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        合成中…
                      </>
                    ) : ttsStatus === "playing" ? (
                      <>
                        <Pause className="size-4" />
                        暂停朗读
                      </>
                    ) : (
                      <>
                        <Volume2 className="size-4" />
                        点击听题
                      </>
                    )}
                  </Button>
                  {ttsStatus === "error" && (
                    <button
                      type="button"
                      onClick={() => setTtsDisabled(true)}
                      className="text-xs text-muted-foreground underline decoration-dotted"
                    >
                      朗读不可用？关闭语音
                    </button>
                  )}
                  {ttsStatus !== "error" && (
                    <span className="text-xs text-muted-foreground">
                      iOS 请确保未开启静音键
                    </span>
                  )}
                </div>
              )}

              {/* Options */}
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
                disabled={!selectedKey}
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
                生成定位报告
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

/* ============================================
   QuizLoadingScreen —— 多阶段"有进度感"加载屏
   ============================================ */

const LOADING_STEPS = [
  { label: "解析求职意向与简历关键词", duration: 1200 },
  { label: "匹配性格测评维度", duration: 2000 },
  { label: "从谨世题库生成 6 道定制题", duration: 15000 },
  { label: "校对题干并加载语音", duration: 2500 },
];

function QuizLoadingScreen() {
  const [stepIdx, setStepIdx] = useState(0);
  const [typedLabel, setTypedLabel] = useState("");
  const [tick, setTick] = useState(0);

  // 阶段切换：基于 duration 累积推进，最后一步停在"加载语音"直到 quizLoading=false 卸载
  useEffect(() => {
    let cancelled = false;
    const advance = async (i: number) => {
      if (cancelled) return;
      setStepIdx(i);
      if (i >= LOADING_STEPS.length - 1) return;
      await new Promise((r) => setTimeout(r, LOADING_STEPS[i].duration));
      if (!cancelled) advance(i + 1);
    };
    advance(0);
    return () => {
      cancelled = true;
    };
  }, []);

  // 给当前 step label 打字机
  useEffect(() => {
    setTypedLabel("");
    const text = LOADING_STEPS[stepIdx]?.label ?? "";
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTypedLabel(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [stepIdx]);

  // 每 200ms 让小点闪烁 / 进度条前进
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, []);

  // 假进度：基于阶段位置 + 当前 step 内累积比例
  const totalDuration = LOADING_STEPS.reduce((a, s) => a + s.duration, 0);
  const passedMs = LOADING_STEPS.slice(0, stepIdx).reduce(
    (a, s) => a + s.duration,
    0
  );
  const bar = Math.min(
    95,
    Math.round(((passedMs + tick * 200 * 0.6) / totalDuration) * 100)
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)] px-6 flex items-center justify-center">
      <div className="fixed top-20 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-[var(--blue-200)] to-[var(--blue-100)] opacity-40 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-20 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-[var(--blue-300)] to-[var(--blue-100)] opacity-30 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center text-xl sm:text-2xl font-bold text-[var(--navy-950)] mb-2 tracking-tight"
        >
          正在为你生成 6 道定制题
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-xs text-[var(--muted-foreground)] mb-8"
        >
          根据你的岗位、学历、公司意向与性格维度定制 · 通常 15-30 秒
        </motion.p>

        {/* 进度条 */}
        <div className="mb-6">
          <div className="h-1 bg-[var(--blue-100)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-400)]"
              animate={{ width: `${bar}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-mono text-[var(--muted-foreground)]">
            <span>STEP {stepIdx + 1} / {LOADING_STEPS.length}</span>
            <span className="tabular-nums">{bar}%</span>
          </div>
        </div>

        {/* 阶段列表 */}
        <div className="space-y-2.5 rounded-xl border border-[var(--blue-100)] bg-white/60 backdrop-blur p-4">
          {LOADING_STEPS.map((step, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <div
                key={i}
                className="flex items-center gap-3 text-[13px]"
              >
                <div className="shrink-0">
                  {done ? (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin text-[var(--blue-500)]" />
                  ) : (
                    <div className="size-4 rounded-full border border-[var(--blue-200)] bg-white" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 min-w-0 leading-snug transition-colors",
                    done
                      ? "text-[var(--muted-foreground)] line-through decoration-[var(--blue-300)]/50"
                      : active
                        ? "text-[var(--navy-900)] font-medium"
                        : "text-[var(--muted-foreground)]/60"
                  )}
                >
                  {active ? (
                    <>
                      {typedLabel}
                      <motion.span
                        className="inline-block ml-0.5 -translate-y-0.5 text-[var(--blue-500)]"
                        aria-hidden
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        ▍
                      </motion.span>
                    </>
                  ) : (
                    step.label
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--muted-foreground)]">
          AI 正在工作 · 请勿关闭页面
        </p>
      </div>
    </div>
  );
}
