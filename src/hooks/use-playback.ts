"use client";

import { useEffect, useState } from "react";

const TICK_MS = 100;

/**
 * Reproducción visual del timelapse (sin audio): avanza una posición en
 * segundos y vuelve al inicio al llegar al final.
 */
export function usePlayback(duration: number, autoPlay = false) {
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!isPlaying || duration <= 0) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setPosition((p) => (p + dt) % duration);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, duration]);

  return {
    position,
    isPlaying,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    toggle: () => setIsPlaying((p) => !p),
    seek: (seconds: number) => setPosition(Math.max(0, Math.min(duration, seconds))),
  };
}
