"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  industries,
  companyTypes,
  cityLevels,
  jobLevels,
  workYears,
} from "@/lib/form-options";
import type { JobFormData } from "@/lib/types";

const formSchema = z.object({
  positionName: z.string().min(1, "请输入岗位名称"),
  industry: z.string().min(1, "请选择所属行业"),
  companyType: z.string().min(1, "请选择企业性质"),
  cityLevel: z.string().min(1, "请选择城市等级"),
  jobLevel: z.string().min(1, "请选择匹配职级"),
  workYears: z.string().min(1, "请选择工作年限"),
});

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const formFields = [
  {
    name: "positionName" as const,
    label: "岗位名称",
    type: "input",
    placeholder: "例如：产品经理、前端工程师、销售总监",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.5 5.5Q7 8 10 8t5.5-2.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function FormPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restore previous form data if available
  const getSavedDefaults = (): JobFormData => {
    if (typeof window === "undefined") return { positionName: "", industry: "", companyType: "", cityLevel: "", jobLevel: "", workYears: "" };
    try {
      const saved = sessionStorage.getItem("formData");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { positionName: "", industry: "", companyType: "", cityLevel: "", jobLevel: "", workYears: "" };
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JobFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getSavedDefaults(),
  });

  const onSubmit = (data: JobFormData) => {
    setIsSubmitting(true);
    // Store form data in sessionStorage for the interview page
    sessionStorage.setItem("formData", JSON.stringify(data));
    // Navigate to interview
    setTimeout(() => {
      router.push("/interview");
    }, 600);
  };

  const watchedValues = watch();
  const filledCount = Object.values(watchedValues).filter((v) => v && v.length > 0).length;
  const progress = (filledCount / 6) * 100;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[var(--blue-50)] via-white to-[var(--blue-100)]" />
      <div className="fixed inset-0 hero-grid opacity-40" />

      {/* Decorative orbs */}
      <div className="fixed top-20 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-[var(--blue-200)] to-[var(--blue-100)] opacity-40 blur-3xl" />
      <div className="fixed -bottom-20 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-[var(--blue-300)] to-[var(--blue-100)] opacity-30 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: cubicEase }}
          className="mb-10"
        >
          {/* Back link */}
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 text-sm text-[var(--navy-600)] hover:text-[var(--navy-800)] transition-colors mb-8 group"
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

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <Badge
              variant="secondary"
              className="bg-[var(--blue-500)] text-white px-3 py-1 text-xs font-medium tracking-wide"
            >
              第 1 步 / 共 3 步
            </Badge>
            <span className="text-sm text-[var(--muted-foreground)]">
              填写来访者基本信息
            </span>
          </div>

          <h1 className="text-3xl font-bold text-[var(--navy-950)] tracking-tight mb-3">
            来访者信息
          </h1>
          <p className="text-[var(--muted-foreground)] leading-relaxed">
            请填写来访者的岗位与行业信息，这将作为 AI
            智能访谈和报告分析的基础数据
          </p>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: cubicEase }}
          className="mb-8"
          style={{ transformOrigin: "left" }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[var(--muted-foreground)]">
              完成进度
            </span>
            <span className="text-xs font-medium text-[var(--navy-700)]">
              {filledCount}/6
            </span>
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
              transition={{
                duration: 0.5,
                delay: 0.1 + index * 0.08,
                ease: cubicEase,
              }}
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

          {/* Submit section */}
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
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="opacity-75"
                    />
                  </svg>
                  正在准备访谈...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  进入 AI 智能访谈
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
              )}
            </Button>

            <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
              填写信息仅用于生成职业分析报告，不会存储或分享给第三方
            </p>
          </motion.div>
        </form>
      </div>
    </div>
  );
}
