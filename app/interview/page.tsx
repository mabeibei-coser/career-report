"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { JobFormData } from "@/lib/types";

interface ChatMessage {
  role: "ai" | "user";
  content: string;
}

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--blue-400)]"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

export default function InterviewPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<JobFormData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load form data and start interview
  useEffect(() => {
    const stored = sessionStorage.getItem("formData");
    if (!stored) {
      router.push("/form");
      return;
    }
    const data = JSON.parse(stored) as JobFormData;
    setFormData(data);

    // Fetch first question
    fetchAIQuestion(data, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function fetchAIQuestion(
    data: JobFormData,
    history: ChatMessage[]
  ) {
    setIsLoading(true);
    try {
      // Convert chat format for API
      const apiMessages = history.map((msg) => ({
        role: msg.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: msg.content,
      }));

      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data, messages: apiMessages }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "请求失败");
      }

      const result = await res.json();
      const aiMessage: ChatMessage = { role: "ai", content: result.message };
      setMessages((prev) => [...prev, aiMessage]);
      setQuestionCount((prev) => prev + 1);

      if (result.isComplete) {
        setIsComplete(true);
      }
    } catch (error) {
      console.error("Failed to fetch AI question:", error);
      const errorMsg: ChatMessage = {
        role: "ai",
        content: "抱歉，AI 服务暂时不可用。请稍后重试，或点击下方按钮跳过访谈直接生成报告。",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || isLoading || !formData) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    // Auto-resize textarea back
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Fetch next AI question
    await fetchAIQuestion(formData, newMessages);
  }

  function handleFinish() {
    if (messages.length === 0) return;
    // Store interview data
    sessionStorage.setItem("interviewMessages", JSON.stringify(messages));
    router.push("/loading");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!formData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--blue-500)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)]" />
      <div className="fixed inset-0 hero-grid opacity-30" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cubicEase }}
        className="relative z-10 border-b border-[var(--blue-200)]/60 bg-white/70 backdrop-blur-xl"
      >
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--navy-800)] to-[var(--blue-500)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L2 6v6l7 4 7-4V6L9 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="9" cy="9" r="2" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--navy-950)]">
                AI 智能访谈
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                {formData.positionName} · {formData.industry}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="bg-[var(--blue-100)] text-[var(--navy-700)] text-xs"
            >
              第 2 步 / 共 3 步
            </Badge>
            <Badge
              variant="outline"
              className="text-xs border-[var(--blue-300)] text-[var(--navy-600)]"
            >
              {questionCount}/5 轮
            </Badge>
          </div>
        </div>
      </motion.header>

      {/* Chat area */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {/* Welcome message */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: cubicEase }}
            className="text-center py-4"
          >
            <div className="inline-flex items-center gap-2 bg-[var(--blue-100)]/60 text-[var(--navy-700)] text-xs px-4 py-2 rounded-full">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4.5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              访谈将进行 3-5 轮，请根据实际情况如实回答
            </div>
          </motion.div>

          {/* Messages */}
          <AnimatePresence mode="popLayout">
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: cubicEase }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="w-8 h-8 shrink-0 mt-1">
                  <AvatarFallback
                    className={
                      msg.role === "ai"
                        ? "bg-gradient-to-br from-[var(--navy-800)] to-[var(--blue-500)] text-white text-xs"
                        : "bg-[var(--blue-200)] text-[var(--navy-800)] text-xs"
                    }
                  >
                    {msg.role === "ai" ? "AI" : "访"}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "ai"
                      ? "bg-white shadow-sm border border-[var(--blue-100)] text-[var(--navy-950)]"
                      : "bg-[var(--navy-900)] text-white"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <Avatar className="w-8 h-8 shrink-0 mt-1">
                <AvatarFallback className="bg-gradient-to-br from-[var(--navy-800)] to-[var(--blue-500)] text-white text-xs">
                  AI
                </AvatarFallback>
              </Avatar>
              <div className="bg-white shadow-sm border border-[var(--blue-100)] rounded-2xl">
                <TypingIndicator />
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: cubicEase }}
        className="relative z-10 border-t border-[var(--blue-200)]/60 bg-white/80 backdrop-blur-xl"
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          {isComplete ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--navy-700)]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="var(--blue-500)" strokeWidth="1.5" />
                  <path d="M5.5 8l2 2 3.5-4" stroke="var(--blue-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                访谈已完成，感谢您的配合
              </div>
              <Button
                onClick={handleFinish}
                className="h-11 px-8 bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white rounded-xl btn-glow"
              >
                生成职业分析报告
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-2">
                  <path d="M5.5 3L11 8l-5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-resize
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="请输入您的回答..."
                  disabled={isLoading}
                  rows={1}
                  className="min-h-[44px] max-h-[120px] resize-none bg-white/60 border-[var(--blue-200)] focus:border-[var(--blue-400)] focus:ring-2 focus:ring-[var(--blue-500)]/20 rounded-xl pr-4 text-sm placeholder:text-[var(--muted-foreground)]/50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="h-11 px-4 bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white rounded-xl disabled:opacity-40"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
                {questionCount >= 3 && !isComplete && (
                  <Button
                    variant="ghost"
                    onClick={handleFinish}
                    className="h-8 text-xs text-[var(--muted-foreground)] hover:text-[var(--navy-700)]"
                  >
                    结束访谈
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
