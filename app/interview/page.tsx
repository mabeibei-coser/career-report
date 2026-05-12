"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SkipForward, Keyboard, Mic } from "lucide-react";
import { AiOrb, type OrbState } from "./_components/ai-orb";
import { MicButton } from "./_components/mic-button";
import { TranscriptPreview } from "./_components/transcript-preview";
import { StepIndicator } from "@/components/ui/step-indicator";
import { useAudioRecorder } from "@/lib/hooks/use-audio-recorder";
import { useAudioVisualizer } from "@/lib/hooks/use-audio-visualizer";
import { useAudioPlayer } from "@/lib/hooks/use-audio-player";
import type { InterviewTurn, InterviewData, JobFormData } from "@/lib/types";

// ---------- 状态机 ----------

type Phase =
  | "init"
  | "greeting"
  | "idle"
  | "loading-q"
  | "speaking-q"
  | "ready"
  | "recording"
  | "transcribing"
  | "preview"
  | "text-input"
  | "done"
  | "error";

interface QuestionItem {
  text: string;
  audioBase64?: string;
  audioUrl?: string;
  questionId?: string;
  audioDurationSec?: number;
}

function audioSrcOf(q: { audioUrl?: string; audioBase64?: string }): string {
  return q.audioUrl ?? q.audioBase64 ?? "";
}

// ---------- 工具 ----------

function canUseVoiceRecording(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  // 不再拦截微信：现代微信 WebView 已支持 MediaRecorder；
  // 若 getUserMedia 实际失败（权限/HTTP），handleRecordStart 的 catch 会降级到文字输入
  return true;
}

const GREETING_TEXT =
  "你好，我是你的 AI 职业顾问，接下来我会问你两个问题，帮你完善这份定位报告。";

// 用 turns 拼一个 raw "summary" 文本，作为 /loading 的兜底（避免被 summarize API 阻塞）
function buildRawTurnsSummary(turns: InterviewTurn[]): string {
  return turns
    .map((t, i) => `第${i + 1}问：${t.questionText}\n候选人回答：${t.userAnswerText || "（未作答）"}`)
    .join("\n\n");
}

// ---------- 主组件 ----------

export default function InterviewPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("init");
  const phaseRef = useRef<Phase>("init");
  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const [turnIndex, setTurnIndex] = useState<0 | 1>(0);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [currentQ, setCurrentQ] = useState<QuestionItem | null>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const targetPositionRef = useRef("目标岗位");

  const [textInput, setTextInput] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [skipConfirm, setSkipConfirm] = useState(false);

  // 预取
  const prefetchedQ1Ref = useRef<Promise<QuestionItem | null> | null>(null);
  const prefetchedQ2Ref = useRef<Promise<QuestionItem | null> | null>(null);
  const q1IdRef = useRef<string | undefined>(undefined);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 录音
  const recorder = useAudioRecorder();
  const { amplitude } = useAudioVisualizer(recorder.mediaStream);

  // 播放结束回调（区分 greeting / Q）
  const player = useAudioPlayer(
    useCallback(() => {
      // 清除 speaking 安全超时
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = null;
      }
      const p = phaseRef.current;
      if (p === "greeting") {
        // 欢迎语播完 → 显示"开始访谈"按钮，等用户点击后再弹麦克风授权
        setPhaseSync("idle");
      } else if (p === "speaking-q") {
        setPhaseSync("ready");
      }
    }, [setPhaseSync])
  );

  // 初始化：读 sessionStorage + 自动播放开场白 + 并行预取 Q1
  useEffect(() => {
    let pos = "目标岗位";
    try {
      const fd = sessionStorage.getItem("formData");
      if (!fd) { router.replace("/form"); return; }
      const formData = JSON.parse(fd) as JobFormData;
      if (!formData?.targetPosition) { router.replace("/form"); return; }
      pos = formData.targetPosition;
      targetPositionRef.current = pos;
    } catch {
      router.replace("/form");
      return;
    }
    setVoiceSupported(canUseVoiceRecording());
    // 后台预编译 /loading 路由（dev 模式消除首次跳转的"Compiling..."等待）
    router.prefetch("/loading");

    // 1) 开场白 TTS
    setPhaseSync("greeting");
    fetch("/api/interview/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ greeting: true }),
    })
      .then((r) => r.json())
      .then((data: { audioUrl?: string; audioBase64?: string }) => {
        const src = data.audioUrl ?? data.audioBase64 ?? "";
        if (src) {
          player.play(src);
        } else {
          setPhaseSync("idle");
        }
      })
      .catch(() => setPhaseSync("idle"));

    // 2) 与 greeting 并行预取 Q1
    prefetchedQ1Ref.current = fetch("/api/interview/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPosition: pos, previousTurns: [] }),
    })
      .then((r) => r.json() as Promise<QuestionItem>)
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ---------- 触发 Q ----------

  const presentQuestion = useCallback(
    (q: QuestionItem) => {
      setCurrentQ(q);
      if (q.questionId && turnIndex === 0) {
        q1IdRef.current = q.questionId;
      }
      const src = audioSrcOf(q);
      if (src) {
        setPhaseSync("speaking-q");
        player.play(src);
        // 安全超时：某些手机浏览器 audio.play() resolve 但不出声也不触发 ended，
        // 15 秒后如果还卡在 speaking-q 就强制推进到 ready
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current === "speaking-q") {
            console.warn("[interview] speaking-q safety timeout, forcing → ready");
            player.stop();
            setPhaseSync("ready");
          }
        }, 15_000);
      } else {
        setPhaseSync("ready");
      }
    },
    [player, setPhaseSync, turnIndex]
  );

  const fetchQuestionFallback = useCallback(
    async (prevTurns: InterviewTurn[]) => {
      try {
        const res = await fetch("/api/interview/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetPosition: targetPositionRef.current,
            previousTurns: prevTurns,
            excludeQuestionIds: q1IdRef.current ? [q1IdRef.current] : [],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const q = (await res.json()) as QuestionItem;
        presentQuestion(q);
      } catch (e) {
        console.error("fetchQuestion failed:", e);
        setError("获取问题失败，请刷新重试");
        setPhaseSync("error");
      }
    },
    [presentQuestion, setPhaseSync]
  );

  // ---------- 开始访谈（欢迎语播完后用户点按钮触发） ----------

  // 注意：这个函数**不能**是 async function！
  // iOS Safari 在 async function 的 await 链中调用 getUserMedia 会丢失 user gesture，
  // 导致授权弹窗被延迟到下一次同步的 getUserMedia 调用（按住麦克风时），不在欢迎页弹。
  // 所以必须用 sync function，第一行同步调 getUserMedia，把弹窗挂在 click 的 sync 执行栈上。
  const handleStart = useCallback(() => {
    const micPromise = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .catch(() => null);

    // 拿到 stream 后存到 recorder（异步），再推进 phase
    micPromise.then(async (stream) => {
      if (stream) {
        recorder.adoptStream(stream);
      }
      setPhaseSync("loading-q");
      const prefetched = await prefetchedQ1Ref.current;
      prefetchedQ1Ref.current = null;
      if (prefetched?.text) {
        presentQuestion(prefetched);
      } else {
        fetchQuestionFallback([]);
      }
    });
  }, [presentQuestion, setPhaseSync, fetchQuestionFallback, recorder]);

  // ---------- 录音 ----------

  const handleRecordStart = useCallback(async () => {
    try {
      await recorder.start();
      setPhaseSync("recording");
    } catch (e) {
      console.error("mic error:", e);
      setVoiceSupported(false);
      setPhaseSync("text-input");
    }
  }, [recorder, setPhaseSync]);

  const prefetchQ2Background = useCallback((turn1: InterviewTurn) => {
    prefetchedQ2Ref.current = fetch("/api/interview/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetPosition: targetPositionRef.current,
        previousTurns: [turn1],
        excludeQuestionIds: q1IdRef.current ? [q1IdRef.current] : [],
      }),
    })
      .then((r) => r.json() as Promise<QuestionItem>)
      .catch(() => null);
  }, []);

  const handleRecordStop = useCallback(async () => {
    setPhaseSync("transcribing");
    let recognized = "";
    let durationSec: number | undefined;
    try {
      const result = await recorder.stop();
      durationSec = result.durationSec;
      if (result.blob.size < 3000 || result.durationSec < 1) {
        recognized = "";
      } else {
        const formData = new FormData();
        formData.append("audio", result.blob, "recording");
        formData.append("mimeType", result.mimeType);
        const res = await fetch("/api/interview/transcribe", { method: "POST", body: formData });
        const data = (await res.json()) as { text: string };
        recognized = data.text ?? "";
      }
    } catch (e) {
      console.error("transcribe error:", e);
      recognized = "";
    }
    setRecognizedText(recognized);
    setCurrentQ((q) => (q ? { ...q, audioDurationSec: durationSec } : q));

    if (turnIndex === 0 && currentQ) {
      prefetchQ2Background({
        index: 0,
        questionText: currentQ.text,
        userAnswerText: recognized,
        inputMethod: "voice",
      });
    }
    setPhaseSync("preview");
  }, [recorder, turnIndex, currentQ, prefetchQ2Background, setPhaseSync]);

  const handleRecordCancel = useCallback(() => {
    recorder.cancel();
    setPhaseSync("ready");
  }, [recorder, setPhaseSync]);

  // ---------- 切换文字 ----------

  const handleSwitchToText = useCallback(() => {
    recorder.cancel();
    setTextInput("");
    setPhaseSync("text-input");
  }, [recorder, setPhaseSync]);

  // ---------- 跳过 ----------

  const handleSkip = useCallback(() => {
    const interviewData: InterviewData = {
      turns: [],
      summary: "",
      skipped: true,
      generatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem("interviewData", JSON.stringify(interviewData));
    router.push("/loading");
  }, [router]);

  // ---------- 完成（直接跳，不阻塞 summarize） ----------

  const finishAndGo = useCallback((completedTurns: InterviewTurn[]) => {
    // 用原始 Q+A 作为 summary 兜底，不阻塞 UI 等 LLM
    const fallbackSummary = buildRawTurnsSummary(completedTurns);
    const interviewData: InterviewData = {
      turns: completedTurns,
      summary: fallbackSummary,
      skipped: false,
      generatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem("interviewData", JSON.stringify(interviewData));
    setPhaseSync("done");
    router.push("/loading");
  }, [router, setPhaseSync]);

  // ---------- 确认答案 ----------

  const handleConfirm = useCallback(
    async (finalText: string) => {
      if (!currentQ) return;
      const turn: InterviewTurn = {
        index: turnIndex,
        questionText: currentQ.text,
        userAnswerText: finalText,
        inputMethod: phaseRef.current === "text-input" ? "text" : "voice",
        audioDurationSec: currentQ.audioDurationSec,
      };
      const newTurns = [...turns, turn];
      setTurns(newTurns);
      setRecognizedText("");
      setTextInput("");

      if (turnIndex === 0) {
        setTurnIndex(1);
        setPhaseSync("loading-q");
        const prefetched = await prefetchedQ2Ref.current;
        prefetchedQ2Ref.current = null;
        if (prefetched?.text) {
          presentQuestion(prefetched);
        } else {
          fetchQuestionFallback(newTurns);
        }
      } else {
        // 第 2 题完成 → 直接进 loading（summarize 改为后台执行）
        finishAndGo(newTurns);
      }
    },
    [currentQ, turnIndex, turns, presentQuestion, fetchQuestionFallback, finishAndGo, setPhaseSync]
  );

  const handleRetryFromPreview = useCallback(() => {
    if (voiceSupported && phaseRef.current !== "text-input") {
      setPhaseSync("ready");
    } else {
      setTextInput("");
    }
  }, [voiceSupported, setPhaseSync]);

  // ---------- Orb 状态 ----------

  const orbState: OrbState = (() => {
    if (phase === "greeting" || phase === "speaking-q") return "speaking";
    if (phase === "recording") return "recording";
    if (phase === "loading-q" || phase === "transcribing") return "processing";
    return "idle";
  })();

  const questionText = currentQ?.text ?? "";

  // ---------- render ----------

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)" }}
    >
      {/* 顶部导航 + Stepper */}
      <div className="relative z-10 px-4 sm:px-6 pt-5 pb-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              onClick={() => setSkipConfirm(true)}
            >
              <SkipForward size={13} />
              跳过访谈
            </button>
            {voiceSupported && (phase === "ready" || phase === "text-input") && (
              <button
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                onClick={
                  phase === "text-input" ? () => setPhaseSync("ready") : handleSwitchToText
                }
              >
                {phase === "text-input" ? <Mic size={13} /> : <Keyboard size={13} />}
                {phase === "text-input" ? "改为语音" : "改为文字"}
              </button>
            )}
          </div>
          <StepIndicator currentStep={1} compact />
        </div>
      </div>

      {/* 主舞台：Orb 中心 + 题面 + Mic */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 gap-6">
        {/* Orb */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.05 }}
        >
          <AiOrb state={orbState} amplitude={amplitude} />
        </motion.div>

        {/* 文案区 */}
        <div className="w-full max-w-md min-h-[100px] flex flex-col items-center justify-start">
          <AnimatePresence mode="wait">
            {(phase === "init" || phase === "greeting" || phase === "idle") && (
              <motion.div
                key="greeting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-[15px] text-slate-700 leading-[1.65]">{GREETING_TEXT}</p>
              </motion.div>
            )}

            {phase === "loading-q" && (
              <motion.div
                key="loading-q"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-slate-400"
              >
                AI 思考中...
              </motion.div>
            )}

            {(phase === "speaking-q" || phase === "ready" || phase === "recording" || phase === "transcribing") && questionText && (
              <motion.div
                key={`q-${turnIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                <div
                  className="px-5 py-4 rounded-2xl text-[15px] leading-[1.7] text-slate-800"
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(8px)",
                    boxShadow:
                      "0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.04)",
                    border: "1px solid rgba(255,255,255,0.9)",
                  }}
                >
                  <div className="text-[10px] tracking-[0.2em] text-blue-500 font-semibold uppercase mb-2">
                    第 {turnIndex + 1} / 2 题
                  </div>
                  {questionText}
                </div>
              </motion.div>
            )}

            {(phase === "preview" || phase === "text-input") && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                <TranscriptPreview
                  text={phase === "preview" ? recognizedText : textInput}
                  onConfirm={handleConfirm}
                  onRetry={handleRetryFromPreview}
                  retryLabel={phase === "preview" ? "重新录音" : "清空重写"}
                />
              </motion.div>
            )}

            {phase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <p className="text-red-500 text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部行动区 */}
        <div className="w-full flex flex-col items-center gap-2 min-h-[100px]">
          <AnimatePresence mode="wait">
            {phase === "greeting" && (
              <motion.div
                key="greeting-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-slate-400"
              >
                AI 正在问候你...
              </motion.div>
            )}

            {phase === "idle" && (
              <motion.button
                key="start-btn"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={handleStart}
                className="px-7 py-3 text-white rounded-full text-sm font-medium shadow-lg active:scale-95 transition-all"
                style={{
                  background: "linear-gradient(135deg, #4f8cff 0%, #3b82f6 100%)",
                  boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
                }}
              >
                准备好了，开始访谈
              </motion.button>
            )}

            {phase === "loading-q" && (
              <motion.div
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-slate-400"
              >
                正在准备问题...
              </motion.div>
            )}

            {(phase === "ready" || phase === "recording") && voiceSupported && (
              <motion.div
                key="mic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-1.5"
              >
                <MicButton
                  onRecordStart={handleRecordStart}
                  onRecordStop={handleRecordStop}
                  onRecordCancel={handleRecordCancel}
                  isRecording={phase === "recording"}
                  durationSec={recorder.durationSec}
                />
                <p className="text-[11px] text-slate-400">
                  {phase === "recording"
                    ? "按住说话 · 松开识别 · 上滑取消"
                    : "按住麦克风开始回答"}
                </p>
              </motion.div>
            )}

            {phase === "ready" && !voiceSupported && (
              <motion.button
                key="text-only-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-7 py-3 bg-blue-600 text-white rounded-full text-sm font-medium shadow-md"
                onClick={handleSwitchToText}
              >
                文字输入
              </motion.button>
            )}

            {phase === "transcribing" && (
              <motion.div
                key="trans"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-slate-400 animate-pulse"
              >
                识别中，请稍候...
              </motion.div>
            )}

            {(phase === "preview" || phase === "text-input") && (
              <motion.div
                key="prev-bottom"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-slate-400"
              >
                修改后点「确认提交」进入下一题 · 第 {turnIndex + 1} / 2 题
              </motion.div>
            )}

            {phase === "speaking-q" && (
              <motion.div
                key="speaking-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-slate-400"
              >
                AI 朗读中...
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 跳过弹窗 */}
      <AnimatePresence>
        {skipConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setSkipConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-slate-800 mb-2">跳过 AI 访谈？</h3>
              <p className="text-sm text-slate-500 mb-5">
                访谈内容可以让报告更个性化，跳过后将直接生成报告。
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => setSkipConfirm(false)}
                >
                  继续访谈
                </button>
                <button
                  className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900"
                  onClick={handleSkip}
                >
                  跳过
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
