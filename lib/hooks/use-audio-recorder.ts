'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_SEC = 60;

function getBestMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

interface UseAudioRecorderReturn {
  start: (requirePrimed?: boolean) => Promise<void>;
  stop: () => Promise<{ blob: Blob; mimeType: string; durationSec: number }>;
  cancel: () => void;
  // 接管外部（用户手势内）已经拿到的麦克风 stream 并保留。
  // 后续 start() 直接复用，避免 iOS 上 getUserMedia 二次弹授权。
  adoptStream: (stream: MediaStream) => void;
  isRecording: boolean;
  durationSec: number;
  mediaStream: MediaStream | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const mimeTypeRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  // 预热的麦克风 stream：在用户手势内 primeStream() 拿到权限后保留下来，
  // 后续 start() 直接复用同一 stream，iOS Safari 不会再次弹授权。
  const primedStreamRef = useRef<MediaStream | null>(null);
  // resolve/reject for the stop() promise
  const stopResolveRef = useRef<((value: { blob: Blob; mimeType: string; durationSec: number }) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 释放当前录音占用的 stream：
  // - 如果用的是 primedStream，只 disable tracks（保留权限，下次 start 复用）
  // - 否则真正 stop tracks
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      if (streamRef.current === primedStreamRef.current) {
        streamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
      } else {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;
    }
  }, []);

  const adoptStream = useCallback((stream: MediaStream) => {
    // 已经有 primed stream → 释放传入的新 stream 避免泄漏
    if (primedStreamRef.current && primedStreamRef.current !== stream) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    // 静音 tracks，等真正录音时再启用，避免 iOS 状态栏一直显示"录音中"
    stream.getAudioTracks().forEach((t) => (t.enabled = false));
    primedStreamRef.current = stream;
  }, []);

  const resetState = useCallback(() => {
    clearTimer();
    stopTracks();
    durationRef.current = 0;
    setDurationSec(0);
    setIsRecording(false);
    setMediaStream(null);
    recorderRef.current = null;
    chunksRef.current = [];
  }, [clearTimer, stopTracks]);

  const stop = useCallback((): Promise<{ blob: Blob; mimeType: string; durationSec: number }> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve({ blob: new Blob([], { type: mimeTypeRef.current || 'audio/webm' }), mimeType: mimeTypeRef.current, durationSec: 0 });
        resetState();
        return;
      }

      stopResolveRef.current = resolve;
      clearTimer();

      // 捕获当前录音的 chunks 引用，防止新录音的 start() 清空 chunksRef 后
      // 旧录音的 onstop 读到空数组
      const myChunks = chunksRef.current;
      const myMimeType = mimeTypeRef.current;

      // 把旧 recorder 的 ondataavailable 也绑定到 myChunks，
      // 这样 stop() 触发的最后一次 dataavailable 写入正确的数组
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          myChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(myChunks, { type: myMimeType || 'audio/webm' });
        const dur = durationRef.current;
        stopTracks();
        setIsRecording(false);
        setMediaStream(null);
        recorderRef.current = null;
        chunksRef.current = [];
        durationRef.current = 0;
        setDurationSec(0);
        if (stopResolveRef.current) {
          stopResolveRef.current({ blob, mimeType: myMimeType, durationSec: dur });
          stopResolveRef.current = null;
        }
      };

      recorder.stop();
    });
  }, [clearTimer, resetState, stopTracks]);

  const start = useCallback(async (requirePrimed = false): Promise<void> => {
    if (isRecording) return;

    let stream: MediaStream;
    if (primedStreamRef.current) {
      stream = primedStreamRef.current;
      stream.getAudioTracks().forEach((t) => (t.enabled = true));
    } else if (requirePrimed) {
      throw new Error('No primed mic stream');
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    streamRef.current = stream;
    setMediaStream(stream);

    const mimeType = getBestMimeType();
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const recorderOptions = mimeType ? { mimeType } : undefined;
    const recorder = new MediaRecorder(stream, recorderOptions);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start(); // 不分片：stop() 时一次性拿到完整 Blob，避免某些手机浏览器分片丢失 EBML 头
    durationRef.current = 0;
    setDurationSec(0);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDurationSec(durationRef.current);
      if (durationRef.current >= MAX_DURATION_SEC) {
        stop();
      }
    }, 1000);
  }, [isRecording, stop]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // override onstop to discard data
      recorder.onstop = null;
      recorder.stop();
    }
    stopResolveRef.current = null;
    resetState();
  }, [resetState]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      // 卸载时彻底释放 primed stream
      if (primedStreamRef.current) {
        primedStreamRef.current.getTracks().forEach((t) => t.stop());
        primedStreamRef.current = null;
      }
    };
  }, [clearTimer, stopTracks]);

  return { start, stop, cancel, adoptStream, isRecording, durationSec, mediaStream };
}
