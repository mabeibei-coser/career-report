"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MicButton from "./MicButton";
import { Button } from "@/components/ui/button";

interface VoiceInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionType = any;

// Check for Web Speech API support
function getSpeechRecognition(): SpeechRecognitionType | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const W = window as any;
  return W.SpeechRecognition || W.webkitSpeechRecognition || null;
}

export default function VoiceInput({ onSend, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(final);
      setInterimTranscript(interim);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const handleSend = useCallback(() => {
    const text = transcript.trim();
    if (text) {
      onSend(text);
      setTranscript("");
      setInterimTranscript("");
    }
  }, [transcript, onSend]);

  if (!isSupported) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          当前浏览器不支持语音输入，请使用文字模式
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Transcript display */}
      <AnimatePresence>
        {(transcript || interimTranscript) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full max-w-md bg-white/60 rounded-xl border border-[var(--blue-200)] px-4 py-3 text-sm text-[var(--navy-800)]"
          >
            {transcript}
            {interimTranscript && (
              <span className="text-[var(--muted-foreground)]">{interimTranscript}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic button */}
      <MicButton
        isRecording={isRecording}
        onPressStart={startRecording}
        onPressEnd={stopRecording}
        disabled={disabled}
      />

      {/* Instruction or send button */}
      {transcript ? (
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSend}
            disabled={disabled}
            className="h-10 px-6 bg-[var(--navy-900)] hover:bg-[var(--navy-800)] text-white rounded-xl"
          >
            发送
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-1.5">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          <button
            onClick={() => { setTranscript(""); setInterimTranscript(""); }}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--navy-700)] transition-colors"
          >
            清除
          </button>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">
          {isRecording ? "正在聆听，点击停止..." : "点击麦克风开始说话"}
        </p>
      )}
    </div>
  );
}
