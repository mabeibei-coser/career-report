"use client";

import { motion, AnimatePresence } from "framer-motion";

interface MicButtonProps {
  isRecording: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  disabled?: boolean;
}

export default function MicButton({
  isRecording,
  onPressStart,
  onPressEnd,
  disabled,
}: MicButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Halo rings — only visible when recording */}
      <AnimatePresence>
        {isRecording && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-[var(--blue-400)]/50"
                initial={{ width: 80, height: 80, opacity: 0.6 }}
                animate={{
                  width: [80, 144],
                  height: [80, 144],
                  opacity: [0.6, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: "easeOut",
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        type="button"
        className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
          disabled
            ? "bg-gray-300 cursor-not-allowed"
            : isRecording
            ? "bg-[var(--blue-400)] shadow-lg shadow-[var(--blue-400)]/30"
            : "bg-[var(--navy-900)] hover:bg-[var(--navy-800)] shadow-lg shadow-[var(--navy-900)]/20"
        }`}
        animate={isRecording ? { scale: 1.1 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          onPressStart();
        }}
        onPointerUp={() => {
          if (disabled) return;
          onPressEnd();
        }}
        onPointerLeave={() => {
          if (isRecording) onPressEnd();
        }}
        disabled={disabled}
      >
        {/* Mic icon */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="11" y="4" width="10" height="16" rx="5" stroke="white" strokeWidth="2" />
          <path d="M8 16a8 8 0 0016 0" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 26v2" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* Recording indicator dot */}
        {isRecording && (
          <motion.div
            className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.button>
    </div>
  );
}
