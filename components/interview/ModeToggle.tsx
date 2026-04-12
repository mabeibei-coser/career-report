"use client";

import { motion } from "framer-motion";

interface ModeToggleProps {
  mode: "text" | "voice";
  onChange: (mode: "text" | "voice") => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg bg-[var(--blue-100)]/60 p-0.5 text-xs">
      {(["text", "voice"] as const).map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          className={`relative px-3 py-1.5 rounded-md transition-colors ${
            mode === m
              ? "text-[var(--navy-900)] font-medium"
              : "text-[var(--muted-foreground)] hover:text-[var(--navy-700)]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {mode === m && (
            <motion.div
              layoutId="mode-toggle-bg"
              className="absolute inset-0 bg-white rounded-md shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1">
            {m === "text" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3h10M2 7h7M2 11h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                文字
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="5" y="2" width="4" height="6" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 7a3 3 0 006 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M7 11v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                语音
              </>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
