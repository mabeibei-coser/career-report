"use client";

import { motion } from "framer-motion";

interface AiOrbProps {
  state: "speaking" | "recording" | "processing" | "idle";
  amplitude?: number; // 0-1, drives scale animation during "recording" state
}

const stateConfig = {
  idle: {
    gradient: "radial-gradient(circle at 35% 35%, #e2e8f0, #cbd5e1 40%, #94a3b8)",
    glowColor: "rgba(148, 163, 184, 0.3)",
    shadowColor: "rgba(148, 163, 184, 0.4)",
  },
  speaking: {
    gradient: "radial-gradient(circle at 35% 35%, #93c5fd, #3b82f6 40%, #1d4ed8)",
    glowColor: "rgba(59, 130, 246, 0.5)",
    shadowColor: "rgba(59, 130, 246, 0.6)",
  },
  recording: {
    gradient: "radial-gradient(circle at 35% 35%, #e9d5ff, #a855f7 40%, #7e22ce)",
    glowColor: "rgba(168, 85, 247, 0.5)",
    shadowColor: "rgba(168, 85, 247, 0.6)",
  },
  processing: {
    gradient: "radial-gradient(circle at 35% 35%, #e2e8f0, #cbd5e1 40%, #94a3b8)",
    glowColor: "rgba(148, 163, 184, 0.3)",
    shadowColor: "rgba(148, 163, 184, 0.3)",
  },
};

export function AiOrb({ state, amplitude = 0 }: AiOrbProps) {
  const config = stateConfig[state];

  // Scale for recording state based on amplitude
  const recordingScale = state === "recording" ? 1 + amplitude * 0.3 : 1;

  // Determine orb animation based on state
  const orbAnimate: { scale: number | number[] } =
    state === "speaking"
      ? { scale: [1, 1.08, 1] }
      : { scale: recordingScale };

  const orbTransition =
    state === "speaking"
      ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" as const }
      : state === "recording"
        ? { duration: 0.05, ease: "linear" as const }
        : { duration: 0.2 };

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      {/* Glow rings for recording state */}
      {state === "recording" && (
        <>
          {[1, 2, 3].map((ring) => (
            <motion.div
              key={ring}
              className="absolute rounded-full"
              style={{
                width: 160,
                height: 160,
                border: `2px solid ${config.glowColor}`,
              }}
              animate={{
                scale: [1, 1.4 + ring * 0.2, 1.8 + ring * 0.3],
                opacity: [0.7, 0.3, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: ring * 0.4,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}

      {/* Glow ring for speaking state */}
      {state === "speaking" && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 160,
            height: 160,
            boxShadow: `0 0 30px 15px ${config.glowColor}`,
          }}
          animate={{
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Spinning arc for processing state */}
      {state === "processing" && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 172,
            height: 172,
            border: "3px solid transparent",
            borderTopColor: "#64748b",
            borderRightColor: "#94a3b8",
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}

      {/* Main orb */}
      <motion.div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: config.gradient,
          boxShadow: `0 8px 32px ${config.shadowColor}, inset 0 -4px 12px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.3)`,
          position: "relative",
          overflow: "hidden",
        }}
        animate={orbAnimate}
        transition={orbTransition}
      >
        {/* Specular highlight for 3D sphere effect */}
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "22%",
            width: "35%",
            height: "28%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)",
            transform: "rotate(-15deg)",
          }}
        />

        {/* Secondary highlight */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "15%",
            width: "18%",
            height: "14%",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.4)",
          }}
        />

        {/* Bottom depth shadow */}
        <div
          style={{
            position: "absolute",
            bottom: "5%",
            left: "15%",
            right: "15%",
            height: "30%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
      </motion.div>
    </div>
  );
}
