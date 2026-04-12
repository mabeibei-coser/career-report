"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { JobFormData } from "@/lib/types";

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const steps = [
  { label: "连接职业知识库", duration: 3000 },
  { label: "识别岗位基础信息", duration: 4000 },
  { label: "分析行业与企业特征", duration: 5000 },
  { label: "匹配岗位对标数据", duration: 6000, hasCounter: true },
  { label: "构建岗职价值模型", duration: 5000 },
  { label: "生成能力画像分析", duration: 6000 },
  { label: "生成发展路径建议", duration: 5000 },
  { label: "输出最终报告", duration: 4000 },
];

const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);

function DataCounter() {
  const [count, setCount] = useState(0);
  const target = 2847563;

  useEffect(() => {
    const duration = 5500;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * eased));
      if (progress >= 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-[var(--blue-400)] font-mono text-xs ml-2">
      已处理 {count.toLocaleString()} 条数据
    </span>
  );
}

export default function LoadingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reportReady, setReportReady] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportFetchStarted = useRef(false);

  // Start report generation in background
  useEffect(() => {
    if (reportFetchStarted.current) return;
    reportFetchStarted.current = true;

    const formDataStr = sessionStorage.getItem("formData");
    const messagesStr = sessionStorage.getItem("interviewMessages");
    const resumeDataStr = sessionStorage.getItem("resumeData");

    if (!formDataStr) {
      router.push("/form");
      return;
    }

    const formData: JobFormData = JSON.parse(formDataStr);
    const messages = messagesStr ? JSON.parse(messagesStr) : [];
    const resumeData = resumeDataStr ? JSON.parse(resumeDataStr) : undefined;

    // Fire the report generation API
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData, messages, resumeData }),
    })
      .then((res) => res.json())
      .then((data) => {
        sessionStorage.setItem("reportData", JSON.stringify(data));
        setReportReady(true);
      })
      .catch((err) => {
        console.error("Report generation failed:", err);
        setError("报告生成失败，请重试");
      });
  }, [router]);

  // Step progression animation
  useEffect(() => {
    let elapsed = 0;
    let stepIndex = 0;

    const interval = setInterval(() => {
      elapsed += 100;

      // Calculate overall progress
      const overallProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(overallProgress);

      // Determine current step
      let accumulated = 0;
      for (let i = 0; i < steps.length; i++) {
        accumulated += steps[i].duration;
        if (elapsed < accumulated) {
          stepIndex = i;
          break;
        }
        if (i === steps.length - 1) {
          stepIndex = steps.length;
        }
      }
      setCurrentStep(stepIndex);

      if (elapsed >= totalDuration) {
        setAnimationDone(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Navigate when both animation and report are done
  useEffect(() => {
    if (animationDone && reportReady) {
      const timer = setTimeout(() => {
        router.push("/report");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [animationDone, reportReady, router]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Dark background */}
      <div className="fixed inset-0 bg-[var(--navy-950)]" />

      {/* Animated gradient orbs */}
      <motion.div
        className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-[100px]"
        style={{ background: "radial-gradient(circle, var(--blue-500), transparent)" }}
        animate={{ x: [0, 50, -30, 0], y: [0, -30, 40, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="fixed bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-[80px]"
        style={{ background: "radial-gradient(circle, var(--blue-400), transparent)" }}
        animate={{ x: [0, -40, 30, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* Grid overlay */}
      <div className="fixed inset-0 hero-grid opacity-20" />

      {/* Main panel */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: cubicEase }}
        className="relative z-10 w-full max-w-lg mx-6"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
              <circle cx="32" cy="32" r="28" stroke="var(--blue-500)" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
              <circle cx="32" cy="32" r="20" stroke="var(--blue-400)" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.5" />
              <circle cx="32" cy="32" r="12" stroke="var(--blue-300)" strokeWidth="2" strokeLinecap="round" strokeDasharray="20 60" />
              <circle cx="32" cy="8" r="2.5" fill="var(--blue-400)" className="pulse-dot" />
            </svg>
          </motion.div>
          <h2 className="text-xl font-semibold text-white mb-2">
            正在生成职业定位报告
          </h2>
          <p className="text-sm text-white/50">
            AI 正在分析您的职业数据，请稍候...
          </p>
        </div>

        {/* Steps list */}
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-3">
          <AnimatePresence>
            {steps.map((step, index) => {
              const status =
                index < currentStep
                  ? "done"
                  : index === currentStep
                    ? "active"
                    : "pending";

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, ease: cubicEase }}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-500 ${
                    status === "active"
                      ? "bg-[var(--blue-500)]/10"
                      : status === "done"
                        ? "opacity-60"
                        : "opacity-30"
                  }`}
                >
                  {/* Status icon */}
                  <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                    {status === "done" ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M3 6l2 2 4-4.5"
                            stroke="#34d399"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </motion.div>
                    ) : status === "active" ? (
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--blue-400)] border-t-transparent animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-white/20" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-sm flex-1 ${
                      status === "active"
                        ? "text-white font-medium"
                        : status === "done"
                          ? "text-white/60"
                          : "text-white/30"
                    }`}
                  >
                    {step.label}
                  </span>

                  {/* Data counter for step 4 */}
                  {step.hasCounter && status === "active" && <DataCounter />}

                  {/* Done check */}
                  {status === "done" && (
                    <span className="text-xs text-emerald-400/60">完成</span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-white/40">处理进度</span>
            <span className="text-xs text-white/60 font-mono">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-300)]"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Waiting message */}
        {animationDone && !reportReady && !error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-white/40 mt-4"
          >
            分析即将完成，请耐心等候...
          </motion.p>
        )}

        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center space-y-3"
          >
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => router.push("/form")}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
            >
              返回重试
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
