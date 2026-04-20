"use client";

import { Brain, Briefcase } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { NegotiationTips } from "@/lib/types";

export function NegotiationSection({
  data,
  index,
  total,
}: {
  data: NegotiationTips;
  index: number;
  total: number;
}) {
  const themes = [
    {
      icon: Brain,
      label: "AI 应用经验",
      tag: "筹码 1",
      summary: data.aiExperience.summary,
      points: data.aiExperience.points,
    },
    {
      icon: Briefcase,
      label: "企业实习 × 成果案例",
      tag: "筹码 2",
      summary: data.internshipExperience.summary,
      points: data.internshipExperience.points,
    },
  ];

  return (
    <SectionWrapper
      id="negotiation"
      title="谈薪要点"
      index={index}
      total={total}
      takeaway="校招能撬动薪资的只有两件事：真实的 AI 应用能力 + 有成果的企业实习"
      meta={<span>2 个核心筹码</span>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {themes.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="rounded-xl border border-[var(--blue-100)] bg-white p-4 sm:p-5 break-inside-avoid"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-[var(--blue-50)] p-1.5 border border-[var(--blue-100)]">
                    <Icon className="size-4 text-[var(--blue-600)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--navy-900)]">
                    {t.label}
                  </h3>
                </div>
                <span className="report-chip">{t.tag}</span>
              </div>
              <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)] mb-4">
                {t.summary}
              </p>
              <div className="report-divider mb-4" />
              <ul className="space-y-2">
                {t.points.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[13.5px] leading-[1.7] text-[var(--navy-800)]"
                  >
                    <span className="tabular-nums shrink-0 pt-0.5 size-5 inline-flex items-center justify-center rounded-full bg-[var(--blue-50)] text-[11px] font-bold text-[var(--blue-600)]">
                      {i + 1}
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
