'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioPlayerReturn {
  play: (audioBase64: string) => void;
  stop: () => void;
  isPlaying: boolean;
}

export function useAudioPlayer(onEnded?: () => void): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);

  // keep ref in sync without re-creating play/stop
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.onended = null;
      audio.onerror = null;
    }
    audioRef.current = null;
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    (audioBase64: string) => {
      // stop any existing playback first
      stop();

      const audio = new Audio('data:audio/mp3;base64,' + audioBase64);

      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
        onEndedRef.current?.();
      };

      audio.onerror = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };

      audioRef.current = audio;
      setIsPlaying(true);
      audio.play().catch(() => {
        setIsPlaying(false);
        audioRef.current = null;
      });
    },
    [stop],
  );

  // cleanup on unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audioRef.current = null;
      }
    };
  }, []);

  return { play, stop, isPlaying };
}
