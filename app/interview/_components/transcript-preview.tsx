"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface TranscriptPreviewProps {
  text: string;                         // initial recognized text (can be "" if ASR failed)
  onConfirm: (finalText: string) => void; // called with possibly-edited text
  onRetry: () => void;                  // called when user clicks retry/re-record
  isLoading?: boolean;                  // if true, show spinner instead of text (transcribing...)
}

export function TranscriptPreview({
  text,
  onConfirm,
  onRetry,
  isLoading = false,
}: TranscriptPreviewProps) {
  const [editedText, setEditedText] = useState(text);

  // Sync editedText when text prop changes (e.g. after a successful ASR)
  useEffect(() => {
    setEditedText(text);
  }, [text]);

  const isAsrFailed = !isLoading && text === "";
  const canConfirm = editedText.trim().length > 0;

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Title */}
      <p className="mb-3 text-sm font-medium text-gray-500">你说的内容：</p>

      {/* Content area — loading state or editable textarea */}
      <div className="relative mb-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-[120px] items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-6"
            >
              {/* Spinner */}
              <svg
                className="h-5 w-5 animate-spin text-blue-500"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-gray-500">识别中...</span>
            </motion.div>
          ) : (
            <motion.div
              key="textarea"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="请在此输入你的回答..."
                className="w-full resize-vertical rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
                style={{
                  minHeight: 120,
                  fontSize: 16, // iOS critical: prevents auto-zoom on focus
                  lineHeight: "1.6",
                }}
              />
              {/* ASR failure hint */}
              {isAsrFailed && (
                <p className="mt-1.5 text-xs text-amber-500">
                  （语音识别未能成功，请手动输入）
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 gap-1.5"
          onClick={onRetry}
          disabled={isLoading}
        >
          <span>🔁</span>
          <span>重新录音</span>
        </Button>

        <Button
          variant="default"
          size="lg"
          className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500/50"
          onClick={() => onConfirm(editedText)}
          disabled={isLoading || !canConfirm}
        >
          <span>✓</span>
          <span>确认提交</span>
        </Button>
      </div>
    </div>
  );
}
