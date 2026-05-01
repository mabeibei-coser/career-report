"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SkipForward, Keyboard } from "lucide-react";
import { AiOrb } from "./_components/ai-orb";
import { MicButton } from "./_components/mic-button";
import { TranscriptPreview } from "./_components/transcript-preview";
import { useAudioRecorder } from "@/lib/hooks/use-audio-recorder";
import { useAudioVisualizer } from "@/lib/hooks/use-audio-visualizer";
import { useAudioPlayer } from "@/lib/hooks/use-audio-player";
import type { InterviewTurn, InterviewData, JobFormData } from "@/lib/types";

// ---------- 状态机类型 ----------

type Phase =
  | "idle"
  | "prefetching"
  | "playing"
  | "ready"
  | "recording"
  | "transcribing"
  | "preview"
  | "text-input"
  | "summarizing"
  | "done"
  | "skipped"
  | "error";

interface TurnDraft {
  questionText: string;
  audioBase64: string;
}

// ---------- 工具 ----------

function canUseVoiceRecording(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  if (/MicroMessenger/i.test(navigator.userAgent)) return false;
  return true;
}

// ---------- 主组件 ----------

export default function InterviewPage() {
  const router = useRouter();

  // 阶段 & 轮次
  const [phase, setPhase] = useState<Phase>("idle");
  const [turnIndex, setTurnIndex] = useState<0 | 1>(0);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [currentDraft, setCurrentDraft] = useState<TurnDraft | null>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [targetPosition, setTargetPosition] = useState("目标岗位");

  // 文字输入模式
  const [textInput, setTextInput] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [skipConfirm, setSkipConfirm] = useState(false);

  // 音频 hooks
  const recorder = useAudioRecorder();
  const { amplitude } = useAudioVisualizer(recorder.mediaStream);
  const player = useAudioPlayer(() => {
    // TTS 播完 → 进 ready 状态
    setPhase("ready");
  });

  // 初始化：读 sessionStorage
  useEffect(() => {
    try {
      const fd = sessionStorage.getItem("formData");
      if (!fd) { router.replace("/form"); return; }
      const formData = JSON.parse(fd) as JobFormData;
      if (!formData?.targetPosition) { router.replace("/form"); return; }
      setTargetPosition(formData.targetPosition);
    } catch {
      router.replace("/form");
    }
    setVoiceSupported(canUseVoiceRecording());
  }, [router]);

  // ---------- 获取问题 + TTS ----------

  const fetchQuestion = useCallback(async (prevTurns: InterviewTurn[]) => {
    setPhase("prefetching");
    try {
      const res = await fetch("/api/interview/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPosition, previousTurns: prevTurns }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { text, audioBase64 } = await res.json() as { text: string; audioBase64: string };
      setCurrentDraft({ questionText: text, audioBase64 });

      if (audioBase64) {
        setPhase("playing");
        player.play(audioBase64);
      } else {
        // TTS 失败 → 直接进 ready
        setPhase("ready");
      }
    } catch (e) {
      console.error("fetchQuestion failed:", e);
      setError("获取问题失败，请刷新重试");
      setPhase("error");
    }
  }, [targetPosition, player]);

  // ---------- 录音 ----------

  const handleRecordStart = useCallback(async () => {
    try {
      await recorder.start();
      setPhase("recording");
    } catch (e) {
      console.error("mic error:", e);
      setVoiceSupported(false);
      setPhase("text-input");
    }
  }, [recorder]);

  const handleRecordStop = useCallback(async () => {
    setPhase("transcribing");
    try {
      const { blob, mimeType, durationSec } = await recorder.stop();

      if (blob.size < 3000 || durationSec < 1) {
        // 太短
        setRecognizedText("");
        setPhase("preview");
        return;
      }

      const formData = new FormData();
      formData.append("audio", blob, "recording");
      formData.append("mimeType", mimeType);

      const res = await fetch("/api/interview/transcribe", {
        method: "POST",
        body: formData,
      });
      const { text } = await res.json() as { text: string };
      setRecognizedText(text ?? "");

      // 保存 audioDurationSec 到 draft
      setCurrentDraft((d) => d ? { ...d, audioDurationSec: durationSec } as TurnDraft & { audioDurationSec: number } : d);
    } catch (e) {
      console.error("transcribe error:", e);
      setRecognizedText("");
    }
    setPhase("preview");
  }, [recorder]);

  const handleRecordCancel = useCallback(() => {
    recorder.cancel();
    setPhase("ready");
  }, [recorder]);

  // ---------- 确认答案 ----------

  const handleConfirm = useCallback(async (finalText: string) => {
    if (!currentDraft) return;

    const turn: InterviewTurn = {
      index: turnIndex,
      questionText: currentDraft.questionText,
      userAnswerText: finalText,
      inputMethod: phase === "text-input" ? "text" : "voice",
      audioDurationSec: (currentDraft as TurnDraft & { audioDurationSec?: number }).audioDurationSec,
    };

    const newTurns = [...turns, turn];
    setTurns(newTurns);

    if (turnIndex === 0) {
      // 去问第二题
      setTurnIndex(1);
      setRecognizedText("");
      setTextInput("");
      await fetchQuestion(newTurns);
    } else {
      // 两轮完成 → 摘要
      await summarizeAndFinish(newTurns);
    }
  }, [currentDraft, turnIndex, turns, phase, fetchQuestion]);

  // ---------- 摘要 ----------

  const summarizeAndFinish = useCallback(async (completedTurns: InterviewTurn[]) => {
    setPhase("summarizing");
    let summary = "";
    try {
      const res = await fetch("/api/interview/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: completedTurns, targetPosition }),
      });
      const data = await res.json() as { summary: string };
      summary = data.summary ?? "";
    } catch (e) {
      console.error("summarize error:", e);
      summary = completedTurns.map((t) => t.userAnswerText).join("\n\n");
    }

    const interviewData: InterviewData = {
      turns: completedTurns,
      summary,
      skipped: false,
      generatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem("interviewData", JSON.stringify(interviewData));
    setPhase("done");
    router.push("/loading");
  }, [targetPosition, router]);

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

  // ---------- 切到文字输入 ----------

  const handleSwitchToText = useCallback(() => {
    recorder.cancel();
    setTextInput("");
    setPhase("text-input");
  }, [recorder]);

  // ---------- 状态映射 ----------

  const orbState = (() => {
    if (phase === "playing") return "speaking";
    if (phase === "recording") return "recording";
    if (phase === "prefetching" || phase === "transcribing" || phase === "summarizing") return "processing";
    return "idle";
  })();

  const questionText = currentDraft?.questionText ?? "";

  // ---------- render ----------

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <button
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          onClick={() => setSkipConfirm(true)}
        >
          <SkipForward size={15} />
          跳过访谈
        </button>
        <div className="text-sm font-medium text-slate-600">
          {phase !== "idle" ? `第 ${turnIndex + 1} / 2 轮` : "AI 访谈"}
        </div>
        {voiceSupported && phase === "ready" && (
          <button
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            onClick={handleSwitchToText}
          >
            <Keyboard size={15} />
            文字回答
          </button>
        )}
        {(!voiceSupported || phase !== "ready") && <div className="w-16" />}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">

        {/* AI Orb */}
        <AiOrb state={orbState} amplitude={amplitude} />

        {/* 问题/状态文字 */}
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-center max-w-xs"
            >
              <p className="text-slate-700 text-base leading-relaxed">
                你好，我是你的 AI 职业顾问，接下来我会问你两个问题，帮你完善这份定位报告。
              </p>
            </motion.div>
          )}

          {(phase === "prefetching") && (
            <motion.div key="prefetching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-slate-400 text-sm">准备问题中...</motion.div>
          )}

          {(phase === "playing" || phase === "ready" || phase === "recording" || phase === "transcribing") && questionText && (
            <motion.div
              key={`q-${turnIndex}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-center max-w-sm"
            >
              <p className="text-slate-700 text-base leading-relaxed">{questionText}</p>
            </motion.div>
          )}

          {phase === "summarizing" && (
            <motion.div key="summarizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-slate-400 text-sm">正在整理你的回答...</motion.div>
          )}

          {phase === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 预览区 */}
        <AnimatePresence>
          {phase === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full max-w-sm">
              <TranscriptPreview
                text={recognizedText}
                onConfirm={handleConfirm}
                onRetry={() => setPhase("ready")}
              />
            </motion.div>
          )}

          {phase === "text-input" && (
            <motion.div key="text-input" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full max-w-sm">
              <TranscriptPreview
                text={textInput}
                onConfirm={handleConfirm}
                onRetry={() => {
                  if (voiceSupported) {
                    setPhase("ready");
                  } else {
                    setTextInput("");
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 麦克风按钮 / 开始按钮 */}
        <AnimatePresence>
          {phase === "idle" && (
            <motion.button
              key="start-btn"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-8 py-3 bg-blue-600 text-white rounded-full text-sm font-medium shadow-md hover:bg-blue-700 active:scale-95 transition-all"
              onClick={() => fetchQuestion([])}
            >
              准备好了，开始访谈
            </motion.button>
          )}

          {phase === "ready" && voiceSupported && (
            <motion.div key="mic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MicButton
                onRecordStart={handleRecordStart}
                onRecordStop={handleRecordStop}
                onRecordCancel={handleRecordCancel}
                isRecording={false}
                durationSec={0}
              />
            </motion.div>
          )}

          {phase === "recording" && (
            <motion.div key="mic-recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MicButton
                onRecordStart={handleRecordStart}
                onRecordStop={handleRecordStop}
                onRecordCancel={handleRecordCancel}
                isRecording={true}
                durationSec={recorder.durationSec}
              />
            </motion.div>
          )}

          {phase === "ready" && !voiceSupported && (
            <motion.button
              key="text-only-btn"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-8 py-3 bg-blue-600 text-white rounded-full text-sm font-medium shadow-md"
              onClick={handleSwitchToText}
            >
              文字输入
            </motion.button>
          )}
        </AnimatePresence>

        {/* 状态提示 */}
        {phase === "transcribing" && (
          <p className="text-sm text-slate-400 animate-pulse">识别中，请稍候...</p>
        )}
        {phase === "recording" && (
          <p className="text-xs text-slate-400">按住说话 · 松开识别 · 上滑取消</p>
        )}
      </div>

      {/* 跳过确认弹窗 */}
      <AnimatePresence>
        {skipConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setSkipConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-slate-800 mb-2">跳过 AI 访谈？</h3>
              <p className="text-sm text-slate-500 mb-5">访谈内容可以让报告更个性化，跳过后将直接生成报告。</p>
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
