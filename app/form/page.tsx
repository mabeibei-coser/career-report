"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
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
import { FileUpload, type FileUploadValue } from "@/components/ui/file-upload";
import { StepIndicator } from "@/components/ui/step-indicator";
import { educationLevels, cityTiers } from "@/lib/form-options";
import { startQuizPrefetch } from "@/lib/quiz-prefetch";
import { startReportPrefetch, clearReportPrefetch } from "@/lib/report-prefetch";
import { clearBgSections } from "@/lib/report-bg-runner";
import type { JobFormData } from "@/lib/types";

const formSchema = z.object({
  targetPosition: z
    .string()
    .min(1, "请输入意向岗位")
    .max(60, "岗位名称过长"),
  targetEducation: z.string().min(1, "请选择最高学历"),
  targetCompany: z
    .string()
    .min(1, "请填写意向公司简称")
    .max(60, "内容过长"),
  targetCityTier: z.string().min(1, "请选择意向城市能级"),
});

type FormValues = z.infer<typeof formSchema>;

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const formFields = [
  {
    name: "targetPosition" as const,
    label: "意向岗位",
    type: "input" as const,
    placeholder: "例如：产品经理、前端工程师、数据分析师",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "targetEducation" as const,
    label: "最高学历",
    type: "select" as const,
    options: [...educationLevels],
    placeholder: "选择最高学历",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3L1.5 7 10 11l8.5-4L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M5 9v4c0 1.66 2.24 3 5 3s5-1.34 5-3V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "targetCompany" as const,
    label: "意向公司简称",
    type: "input" as const,
    placeholder: "例如：字节、腾讯、招行、中信建投、安永",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 17v-4h6v4M7 8h2M7 11h2M11 8h2M11 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "targetCityTier" as const,
    label: "意向城市能级",
    type: "select" as const,
    options: [...cityTiers],
    placeholder: "选择意向城市能级",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L3 8v9a1 1 0 001 1h12a1 1 0 001-1V8l-7-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 18v-5h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function getSavedDefaults(): Partial<FormValues> & {
  resume: FileUploadValue | null;
} {
  const empty = {
    targetPosition: "",
    targetEducation: "",
    targetCompany: "",
    targetCityTier: "",
    resume: null,
  };
  if (typeof window === "undefined") return empty;
  try {
    const saved = sessionStorage.getItem("formData");
    if (!saved) return empty;
    const parsed = JSON.parse(saved) as Partial<JobFormData>;
    return {
      targetPosition: parsed.targetPosition ?? "",
      targetEducation: parsed.targetEducation ?? "",
      targetCompany: parsed.targetCompany ?? "",
      targetCityTier: parsed.targetCityTier ?? "",
      resume:
        parsed.resumeText && parsed.resumeFileName
          ? { fileName: parsed.resumeFileName, text: parsed.resumeText }
          : null,
    };
  } catch {
    return empty;
  }
}

export default function FormPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saved = getSavedDefaults();
  const [resume, setResume] = useState<FileUploadValue | null>(saved.resume);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetPosition: saved.targetPosition ?? "",
      targetEducation: saved.targetEducation ?? "",
      targetCompany: saved.targetCompany ?? "",
      targetCityTier: saved.targetCityTier ?? "",
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const payload: JobFormData = {
      ...data,
      resumeText: resume?.text,
      resumeFileName: resume?.fileName,
    };
    sessionStorage.setItem("formData", JSON.stringify(payload));
    sessionStorage.removeItem("quizAnswers");
    sessionStorage.removeItem("reportData");
    if (resume?.resumeRef) sessionStorage.setItem("resumeRef", resume.resumeRef);
    else sessionStorage.removeItem("resumeRef");
    if (resume?.resumeFilename) sessionStorage.setItem("resumeFilename", resume.resumeFilename);
    else sessionStorage.removeItem("resumeFilename");
    // 提前预拉测评题：利用导航 + React mount 的 0.5-1.5s 消化掉一部分 MiniMax 等待
    startQuizPrefetch(payload);
    // 提前预拉不依赖测评画像的 4 个章节（答题期间并行跑）
    startReportPrefetch(payload);
    router.push("/quiz");
  };

  useEffect(() => {
    // 用户返回表单重新填写：清理旧的预拉取，防止提交新表单后拿到旧数据
    clearReportPrefetch();
    clearBgSections();   // 用户回 form 重填时清掉 quiz 阶段启动的后台任务
    // 后台预编译 /quiz 路由（dev 模式消除首次跳转的"Compiling..."等待）
    router.prefetch("/quiz");
  }, [router]);

  const watchedValues = watch();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)]" />
      <div className="fixed inset-0 hero-grid opacity-40" />

      <div className="fixed top-20 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-[var(--blue-200)] to-[var(--blue-100)] opacity-40 blur-3xl" />
      <div className="fixed -bottom-20 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-[var(--blue-300)] to-[var(--blue-100)] opacity-30 blur-3xl" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: cubicEase }}
          className="mb-10"
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 text-sm text-[var(--navy-600)] hover:text-[var(--navy-800)] transition-colors mb-6 sm:mb-8 group"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform group-hover:-translate-x-1"
            >
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            返回首页
          </button>

          <p className="text-xs sm:text-sm text-[var(--blue-500)] font-medium mb-3 tracking-wide">
            5 分钟完成职业定位自测
          </p>

          <StepIndicator currentStep={0} compact className="mb-6" />

          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--navy-950)] tracking-tight mb-3">
            你的求职意向
          </h1>
          <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed">
            面向应届大学生的校招定位工具。填写岗位、学历、公司、城市四项意向，可选上传简历，AI
            将据此完成 6 题快测并生成个性化报告。
          </p>
        </motion.div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
          {formFields.map((field, index) => (
            <motion.div
              key={field.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.1 + index * 0.08,
                ease: cubicEase,
              }}
            >
              <div className="glass-card rounded-xl p-4 sm:p-5 transition-all duration-300 hover:shadow-md">
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
                    className="h-11 text-base md:text-sm bg-white/60 border-[var(--blue-200)] focus:border-[var(--blue-400)] focus:ring-2 focus:ring-[var(--blue-500)]/20 transition-all placeholder:text-[var(--muted-foreground)]/50"
                  />
                ) : (
                  <Select
                    value={watchedValues[field.name]}
                    onValueChange={(val) =>
                      setValue(field.name, val ?? "", { shouldValidate: true })
                    }
                  >
                    <SelectTrigger
                      id={field.name}
                      className="w-full h-11 text-base md:text-sm bg-white/60 border-[var(--blue-200)] focus:border-[var(--blue-400)] focus:ring-2 focus:ring-[var(--blue-500)]/20 transition-all data-[placeholder]:text-[var(--muted-foreground)]/50"
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

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.1 + formFields.length * 0.08,
              ease: cubicEase,
            }}
          >
            <div className="glass-card rounded-xl p-4 sm:p-5">
              <Label className="flex items-center gap-2 text-sm font-medium text-[var(--navy-800)] mb-3">
                <span className="text-[var(--blue-500)]">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M12 2H5a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V6l-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                简历上传
              </Label>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                上传后，AI 将结合你的实习、项目、技能给出更个性化的分析和简历诊断；不传也能生成报告。
              </p>
              <FileUpload
                value={resume}
                onChange={setResume}
                accept=".pdf,.doc,.docx"
                maxSizeMB={5}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.1 + (formFields.length + 1) * 0.08,
              ease: cubicEase,
            }}
            className="pt-2 sm:pt-4"
          >
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white rounded-xl btn-glow transition-all duration-300"
            >
              <span className="flex items-center gap-2">
                下一步
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M6.5 4L12 9l-5.5 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Button>

            <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
              信息仅用于本次报告生成，不会存储或分享给第三方
            </p>
          </motion.div>
        </form>
      </div>
    </div>
  );
}
