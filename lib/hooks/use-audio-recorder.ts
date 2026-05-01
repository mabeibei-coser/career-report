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
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; mimeType: string; durationSec: number }>;
  cancel: () => void;
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
  // resolve/reject for the stop() promise
  const stopResolveRef = useRef<((value: { blob: Blob; mimeType: string; durationSec: number }) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
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

      recorder.onstop = () => {
        const mimeType = mimeTypeRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const dur = durationRef.current;
        stopTracks();
        setIsRecording(false);
        setMediaStream(null);
        recorderRef.current = null;
        chunksRef.current = [];
        durationRef.current = 0;
        setDurationSec(0);
        if (stopResolveRef.current) {
          stopResolveRef.current({ blob, mimeType, durationSec: dur });
          stopResolveRef.current = null;
        }
      };

      recorder.stop();
    });
  }, [clearTimer, resetState, stopTracks]);

  const start = useCallback(async (): Promise<void> => {
    if (isRecording) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

    recorder.start(100); // collect chunks every 100ms
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
    };
  }, [clearTimer, stopTracks]);

  return { start, stop, cancel, isRecording, durationSec, mediaStream };
}
