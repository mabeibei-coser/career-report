"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  industries,
  companyTypes,
  cityLevels,
  jobLevels,
  workYears,
} from "@/lib/form-options";
import type { JobFormData, ResumeData, ResumeExtraInfo } from "@/lib/types";

// ─── Schema & Constants ─────────────────────────────────────

const formSchema = z.object({
  positionName: z.string().min(1, "请输入岗位名称"),
  industry: z.string().min(1, "请选择所属行业"),
  companyType: z.string().min(1, "请选择企业性质"),
  cityLevel: z.string().min(1, "请选择城市等级"),
  jobLevel: z.string().min(1, "请选择匹配职级"),
  workYears: z.string().min(1, "请选择工作年限"),
});

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

type PageState = "choose" | "resume-parsing" | "resume-confirm" | "manual";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ─── Form field definitions ─────────────────────────────────

const formFields = [
  {
    name: "positionName" as const,
    label: "岗位名称",
    type: "input",
    placeholder: "例如：产品经理、前端工程师、销售总监",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "industry" as const,
    label: "所属行业",
    type: "select",
    options: industries,
    placeholder: "选择行业",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M3 17V8l5-5 4 4V3h5v14H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7 13v4M11 10v7M15 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "companyType" as const,
    label: "企业性质",
    type: "select",
    options: companyTypes,
    placeholder: "选择企业类型",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "cityLevel" as const,
    label: "城市等级",
    type: "select",
    options: cityLevels,
    placeholder: "选择城市等级",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L3 8v9a1 1 0 001 1h12a1 1 0 001-1V8l-7-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 18v-5h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "jobLevel" as const,
    label: "匹配职级",
    type: "select",
    options: jobLevels,
    placeholder: "选择职级",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M4 16l4-4 3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "workYears" as const,
    label: "工作年限",
    type: "select",
    options: workYears,
    placeholder: "选择工作年限",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// ─── Parsing Steps ──────────────────────────────────────────

const parsingSteps = [
  { label: "提取文本内容", icon: "doc" },
  { label: "AI 智能识别中", icon: "ai" },
  { label: "填充表单字段", icon: "form" },
] as const;

// ─── Main Page Component ────────────────────────────────────

export default function FormPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("choose");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseStep, setParseStep] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [extraInfo, setExtraInfo] = useState<ResumeExtraInfo>({});
  const [extractedFieldKeys, setExtractedFieldKeys] = useState<Set<string>>(new Set());
  const [rawText, setRawText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore previous form data
  const getSavedDefaults = (): JobFormData => {
    if (typeof window === "undefined")
      return { positionName: "", industry: "", companyType: "", cityLevel: "", jobLevel: "", workYears: "" };
    try {
      const saved = sessionStorage.getItem("formData");
      if (saved) return JSON.parse(saved);
    } catch { /* empty */ }
    return { positionName: "", industry: "", companyType: "", cityLevel: "", jobLevel: "", workYears: "" };
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<JobFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getSavedDefaults(),
  });

  const watchedValues = watch();
  const filledCount = Object.values(watchedValues).filter((v) => v && v.length > 0).length;
  const progress = (filledCount / 6) * 100;

  // ─── File validation ───────────────────────────────────

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return "文件大小不能超过 10MB";
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    const typeOk = ACCEPTED_TYPES.includes(file.type);
    const extOk = ext ? ACCEPTED_EXTENSIONS.includes(ext) : false;
    if (!typeOk && !extOk) return "不支持的文件格式，请上传 PDF、DOCX 或 DOC 文件";
    return null;
  }, []);

  // ─── Upload & Parse ────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        setParseError(error);
        return;
      }

      setParseError(null);
      setUploadedFileName(file.name);
      setPageState("resume-parsing");
      setParseStep(0);

      // Step 1: extracting text (show immediately)
      await new Promise((r) => setTimeout(r, 400));
      setParseStep(1);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/resume/parse", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "解析失败，请重试");
        }

        // Step 2: AI recognized
        setParseStep(2);
        await new Promise((r) => setTimeout(r, 300));

        const data = await res.json();

        // Fill form fields
        const extracted = new Set<string>();
        const fields = data.extractedFields || {};
        for (const key of Object.keys(fields)) {
          if (fields[key]) {
            setValue(key as keyof JobFormData, fields[key], { shouldValidate: true });
            extracted.add(key);
          }
        }
        setExtractedFieldKeys(extracted);
        setExtraInfo(data.extraInfo || {});
        setRawText(data.rawText || "");

        // Step 3: form filled
        setParseStep(3);
        await new Promise((r) => setTimeout(r, 500));

        setPageState("resume-confirm");
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "解析失败，请重试");
        setPageState("choose");
      }
    },
    [validateFile, setValue]
  );

  // ─── Drag & Drop ───────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [handleFileUpload]
  );

  // ─── Submit ────────────────────────────────────────────

  const onSubmit = (data: JobFormData) => {
    setIsSubmitting(true);
    sessionStorage.setItem("formData", JSON.stringify(data));

    // Store resume data if available
    if (pageState === "resume-confirm" && rawText) {
      const ext = uploadedFileName.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
      const fileType = ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : "doc";
      const resumeData: ResumeData = {
        rawText,
        fileName: uploadedFileName,
        fileType,
        extractedFields: Object.fromEntries(
          Array.from(extractedFieldKeys).map((k) => [k, data[k as keyof JobFormData]])
        ),
        extraInfo,
      };
      sessionStorage.setItem("resumeData", JSON.stringify(resumeData));
    } else {
      sessionStorage.removeItem("resumeData");
    }

    setTimeout(() => router.push("/interview"), 600);
  };

  // ─── Reset handlers ────────────────────────────────────

  const handleReupload = () => {
    setPageState("choose");
    setParseError(null);
    setExtractedFieldKeys(new Set());
    setExtraInfo({});
    setRawText("");
    reset({ positionName: "", industry: "", companyType: "", cityLevel: "", jobLevel: "", workYears: "" });
  };

  const handleManualFill = () => {
    setPageState("manual");
    setExtractedFieldKeys(new Set());
    setExtraInfo({});
    setRawText("");
    reset({ positionName: "", industry: "", companyType: "", cityLevel: "", jobLevel: "", workYears: "" });
  };

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)]" />
      <div className="fixed inset-0 hero-grid opacity-40" />
      <div className="fixed top-20 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-[var(--blue-200)] to-[var(--blue-100)] opacity-40 blur-3xl" />
      <div className="fixed -bottom-20 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-[var(--blue-300)] to-[var(--blue-100)] opacity-30 blur-3xl" />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: cubicEase }}
          className="mb-10"
        >
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 text-sm text-[var(--navy-600)] hover:text-[var(--navy-800)] transition-colors mb-8 group"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:-translate-x-1">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            返回首页
          </button>

          <div className="flex items-center gap-3 mb-6">
            <Badge variant="secondary" className="bg-[var(--blue-500)] text-white px-3 py-1 text-xs font-medium tracking-wide">
              第 1 步 / 共 3 步
            </Badge>
            <span className="text-sm text-[var(--muted-foreground)]">
              {pageState === "choose" || pageState === "resume-parsing"
                ? "上传简历或手动填写"
                : pageState === "resume-confirm"
                ? "确认 AI 识别结果"
                : "填写来访者基本信息"}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {(pageState === "choose" || pageState === "resume-parsing") && (
              <motion.div key="choose-header" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <h1 className="text-3xl font-bold text-[var(--navy-950)] tracking-tight mb-3">AI 职业定位分析</h1>
                <p className="text-[var(--muted-foreground)] leading-relaxed">上传简历，AI 自动识别您的职业信息</p>
              </motion.div>
            )}
            {pageState === "resume-confirm" && (
              <motion.div key="confirm-header" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <h1 className="text-3xl font-bold text-[var(--navy-950)] tracking-tight mb-3">AI 已识别以下信息</h1>
                <p className="text-[var(--muted-foreground)] leading-relaxed">请确认或修改，未识别的字段需要手动补充</p>
              </motion.div>
            )}
            {pageState === "manual" && (
              <motion.div key="manual-header" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <h1 className="text-3xl font-bold text-[var(--navy-950)] tracking-tight mb-3">来访者信息</h1>
                <p className="text-[var(--muted-foreground)] leading-relaxed">请填写来访者的岗位与行业信息，这将作为 AI 智能访谈和报告分析的基础数据</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Main content area */}
        <AnimatePresence mode="wait">
          {/* ═══ STATE: choose ═══ */}
          {pageState === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5, ease: cubicEase }}
            >
              {/* Upload zone */}
              <div
                className={`glass-card rounded-2xl p-8 transition-all duration-300 cursor-pointer group ${
                  isDragging
                    ? "border-2 !border-[var(--blue-400)] bg-[var(--blue-50)]/80 scale-[1.01]"
                    : "border-2 border-dashed border-[var(--blue-200)] hover:border-[var(--blue-400)] hover:bg-[var(--blue-50)]/40"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                <div className="flex flex-col items-center py-10">
                  {/* Document icon */}
                  <motion.div
                    className="mb-6"
                    animate={isDragging ? { scale: 1.12, y: -4 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--blue-100)] to-[var(--blue-200)] flex items-center justify-center shadow-sm">
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-[var(--blue-500)]">
                        <path
                          d="M8 4h10l8 8v16a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path d="M18 4v8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 20h8M12 24h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </motion.div>

                  <p className="text-base font-medium text-[var(--navy-800)] mb-2">
                    拖拽文件到此处，或{" "}
                    <span className="text-[var(--blue-500)] group-hover:underline">点击上传</span>
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    支持 PDF、Word (.docx/.doc) 格式，文件大小不超过 10MB
                  </p>
                </div>
              </div>

              {/* Error message */}
              {parseError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 mt-0.5">
                    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M9 6v3.5M9 12h.005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {parseError}
                </motion.div>
              )}

              {/* Manual fill link */}
              <div className="text-center mt-8">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualFill();
                  }}
                  className="text-sm text-[var(--muted-foreground)] hover:text-[var(--navy-700)] transition-colors"
                >
                  没有简历？
                  <span className="text-[var(--blue-500)] hover:underline ml-1">手动填写信息 →</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STATE: resume-parsing ═══ */}
          {pageState === "resume-parsing" && (
            <motion.div
              key="parsing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5, ease: cubicEase }}
            >
              <div className="glass-card rounded-2xl p-8">
                <div className="flex flex-col items-center py-6">
                  {/* Steps */}
                  <div className="w-full max-w-xs space-y-5 mb-8">
                    {parsingSteps.map((step, i) => {
                      const status = i < parseStep ? "done" : i === parseStep ? "active" : "pending";
                      return (
                        <motion.div
                          key={step.label}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.15, duration: 0.4, ease: cubicEase }}
                          className="flex items-center gap-3"
                        >
                          {/* Status icon */}
                          <div className="w-6 h-6 flex items-center justify-center">
                            {status === "done" && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                  <circle cx="10" cy="10" r="9" fill="var(--blue-500)" />
                                  <path d="M6.5 10l2.5 2.5 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </motion.div>
                            )}
                            {status === "active" && (
                              <div className="w-5 h-5 rounded-full border-2 border-[var(--blue-400)] border-t-transparent animate-spin" />
                            )}
                            {status === "pending" && (
                              <div className="w-5 h-5 rounded-full border-2 border-[var(--blue-200)]" />
                            )}
                          </div>

                          <span
                            className={`text-sm font-medium transition-colors ${
                              status === "done"
                                ? "text-[var(--navy-800)]"
                                : status === "active"
                                ? "text-[var(--blue-500)]"
                                : "text-[var(--muted-foreground)]"
                            }`}
                          >
                            {step.label}
                            {status === "active" && "..."}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full max-w-xs">
                    <div className="h-1.5 bg-[var(--blue-100)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-400)]"
                        initial={{ width: "5%" }}
                        animate={{ width: `${Math.min(((parseStep + 1) / parsingSteps.length) * 100, 100)}%` }}
                        transition={{ duration: 0.6, ease: cubicEase }}
                      />
                    </div>
                  </div>

                  {/* File name */}
                  <p className="text-xs text-[var(--muted-foreground)] mt-4 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 2h5l4 4v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M8 2v4h4" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    {uploadedFileName}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ STATE: resume-confirm ═══ */}
          {pageState === "resume-confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: cubicEase }}
            >
              {/* Resume summary banner */}
              {(extraInfo.schoolName || extraInfo.skills?.length || extraInfo.workHistory) && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5, ease: cubicEase }}
                  className="glass-card rounded-xl p-5 mb-6 border border-[var(--blue-200)]/60"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--blue-500)]">
                      <path d="M2 3h12v10H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                      <path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span className="text-xs font-medium text-[var(--navy-700)]">简历摘要</span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--navy-800)]">
                    {extraInfo.schoolName && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[var(--blue-400)]">🎓</span>
                        {extraInfo.schoolName}
                      </span>
                    )}
                    {extraInfo.workHistory && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[var(--blue-400)]">💼</span>
                        {extraInfo.workHistory}
                      </span>
                    )}
                  </div>
                  {extraInfo.skills && extraInfo.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {extraInfo.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[var(--blue-50)] text-[var(--blue-500)] border border-[var(--blue-200)]/50"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Progress bar */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.4, delay: 0.15, ease: cubicEase }}
                className="mb-6"
                style={{ transformOrigin: "left" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[var(--muted-foreground)]">完成进度</span>
                  <span className="text-xs font-medium text-[var(--navy-700)]">{filledCount}/6</span>
                </div>
                <div className="h-1.5 bg-[var(--blue-100)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-400)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: cubicEase }}
                  />
                </div>
              </motion.div>

              {/* Confirm form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {formFields.map((field, index) => {
                  const isExtracted = extractedFieldKeys.has(field.name);
                  return (
                    <motion.div
                      key={field.name}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 + index * 0.05, ease: cubicEase }}
                    >
                      <div className="glass-card rounded-xl p-4 transition-all duration-200 hover:shadow-md">
                        <div className="flex items-center justify-between mb-2.5">
                          <Label
                            htmlFor={field.name}
                            className="flex items-center gap-2 text-sm font-medium text-[var(--navy-800)]"
                          >
                            <span className="text-[var(--blue-500)]">{field.icon}</span>
                            {field.label}
                            {!isExtracted && <span className="text-red-400 text-xs">*</span>}
                          </Label>
                          {isExtracted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--blue-50)] text-[var(--blue-500)] border border-[var(--blue-200)]/50">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2.5 5l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              AI 提取
                            </span>
                          )}
                        </div>

                        {field.type === "input" ? (
                          <Input
                            id={field.name}
                            placeholder={field.placeholder}
                            {...register(field.name)}
                            className="h-10 bg-white/60 border-[var(--blue-200)] focus:border-[var(--blue-400)] focus:ring-2 focus:ring-[var(--blue-500)]/20 transition-all placeholder:text-[var(--muted-foreground)]/50"
                          />
                        ) : (
                          <Select
                            value={watchedValues[field.name]}
                            onValueChange={(val) => setValue(field.name, val ?? "", { shouldValidate: true })}
                          >
                            <SelectTrigger
                              id={field.name}
                              className="h-10 bg-white/60 border-[var(--blue-200)] focus:border-[var(--blue-400)] focus:ring-2 focus:ring-[var(--blue-500)]/20 transition-all data-[placeholder]:text-[var(--muted-foreground)]/50"
                            >
                              <SelectValue placeholder={field.placeholder} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {field.options?.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {errors[field.name] && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-500 mt-2 flex items-center gap-1"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M6 4v2.5M6 8h.005" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                            {errors[field.name]?.message}
                          </motion.p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Submit */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.55, ease: cubicEase }}
                  className="pt-4"
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-medium bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white rounded-xl btn-glow transition-all duration-300 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                        </svg>
                        正在准备访谈...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        开始职业分析
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M6.5 4L12 9l-5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-4 mt-5 text-xs text-[var(--muted-foreground)]">
                    <button type="button" onClick={handleReupload} className="hover:text-[var(--blue-500)] transition-colors">
                      重新上传简历
                    </button>
                    <span className="w-px h-3 bg-[var(--blue-200)]" />
                    <button type="button" onClick={handleManualFill} className="hover:text-[var(--blue-500)] transition-colors">
                      清除并手动填写
                    </button>
                  </div>
                </motion.div>
              </form>
            </motion.div>
          )}

          {/* ═══ STATE: manual ═══ */}
          {pageState === "manual" && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: cubicEase }}
            >
              {/* Progress bar */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.2, ease: cubicEase }}
                className="mb-8"
                style={{ transformOrigin: "left" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[var(--muted-foreground)]">完成进度</span>
                  <span className="text-xs font-medium text-[var(--navy-700)]">{filledCount}/6</span>
                </div>
                <div className="h-1.5 bg-[var(--blue-100)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-400)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: cubicEase }}
                  />
                </div>
              </motion.div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {formFields.map((field, index) => (
                  <motion.div
                    key={field.name}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: cubicEase }}
                  >
                    <div className="glass-card rounded-xl p-5 transition-all duration-300 hover:shadow-md">
                      <Label
                        htmlFor={field.name}
                        className="flex items-center gap-2 text-sm font-medium text-[var(--navy-800)] mb-3"
                      >
                        <span className="text-[var(--blue-500)]">{field.icon}</span>
                        {field.label}
                        <span className="text-red-400 text-xs">*</span>
                      </Label>

                      {field.type === "input" ? (
                        <Input
                          id={field.name}
                          placeholder={field.placeholder}
                          {...register(field.name)}
                          className="h-11 bg-white/60 border-[var(--blue-200)] focus:border-[var(--blue-400)] focus:ring-2 focus:ring-[var(--blue-500)]/20 transition-all placeholder:text-[var(--muted-foreground)]/50"
                        />
                      ) : (
                        <Select
                          value={watchedValues[field.name]}
                          onValueChange={(val) => setValue(field.name, val ?? "", { shouldValidate: true })}
                        >
                          <SelectTrigger
                            id={field.name}
                            className="h-11 bg-white/60 border-[var(--blue-200)] focus:border-[var(--blue-400)] focus:ring-2 focus:ring-[var(--blue-500)]/20 transition-all data-[placeholder]:text-[var(--muted-foreground)]/50"
                          >
                            <SelectValue placeholder={field.placeholder} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {field.options?.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {errors[field.name] && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 mt-2 flex items-center gap-1"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M6 4v2.5M6 8h.005" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                          {errors[field.name]?.message}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Submit */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6, ease: cubicEase }}
                  className="pt-4"
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-medium bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white rounded-xl btn-glow transition-all duration-300 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                        </svg>
                        正在准备访谈...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        进入 AI 智能访谈
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M6.5 4L12 9l-5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-4 mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setPageState("choose");
                        reset({ positionName: "", industry: "", companyType: "", cityLevel: "", jobLevel: "", workYears: "" });
                      }}
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--blue-500)] transition-colors"
                    >
                      ← 返回上传简历
                    </button>
                  </div>

                  <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
                    填写信息仅用于生成职业分析报告，不会存储或分享给第三方
                  </p>
                </motion.div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
