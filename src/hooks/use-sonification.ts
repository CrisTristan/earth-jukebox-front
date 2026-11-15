"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { PlayerFrame } from "@/lib/player";
import { Sonifier, type LayerMode, type Preset, type SoundProfile } from "@/lib/sound/sonifier";

/** Gestos que desbloquean el audio si el navegador no dejó sonar al entrar. */
const GESTURES = ["pointerup", "touchend", "keydown"] as const;

interface Settings {
  /** 0–100 (0 = silencio). */
  volume: number;
  layers: LayerMode;
  preset: Preset;
}

/**
 * - `starting`: comprobando si el navegador deja sonar.
 * - `running`: el audio suena.
 * - `blocked`: el navegador exige un gesto (la URL se abrió directamente, sin
 *   haber interactuado antes con el sitio).
 */
export type SoundStatus = "starting" | "running" | "blocked";

/**
 * Sonificación sincronizada con el timelapse: suena el frame actual mientras se
 * reproduce y, en pausa, cada frame al que se salta. Intenta sonar en cuanto se
 * entra en la track; si el navegador no lo permite, arranca con el primer gesto.
 */
export function useSonification(profile: SoundProfile, frames: PlayerFrame[], frameIndex: number, playing: boolean, settings: Settings) {
  const [engine] = useState(() => new Sonifier(profile));
  const [status, setStatus] = useState<SoundStatus>("starting");
  const shown = useRef(frameIndex);

  const enable = () => {
    if (engine.running) return;
    // `start` crea y reanuda el contexto de audio de forma síncrona, dentro del gesto.
    void engine.start().then((ok) => {
      if (ok) setStatus("running");
    });
  };

  // Al entrar: sonar sin esperar un gesto, si el navegador lo permite.
  useEffect(() => {
    let alive = true;
    void engine.tryStart().then((ok) => {
      if (alive) setStatus((s) => (s === "running" || ok ? "running" : "blocked"));
    });
    return () => {
      alive = false;
      engine.dispose();
    };
  }, [engine]);

  const onGesture = useEffectEvent(enable);
  useEffect(() => {
    const handler = () => onGesture();
    for (const type of GESTURES) window.addEventListener(type, handler, true);
    return () => {
      for (const type of GESTURES) window.removeEventListener(type, handler, true);
    };
  }, []);

  const running = status === "running";
  useEffect(() => engine.setVolume(settings.volume), [engine, settings.volume, running]);
  useEffect(() => engine.setLayers(settings.layers), [engine, settings.layers, running]);
  useEffect(() => engine.setPreset(settings.preset), [engine, settings.preset]);

  useEffect(() => {
    if (!running) return;
    const f = frames[frameIndex];
    if (!f) return;
    const frame = { features: f.features, land: f.land };
    if (playing) {
      engine.play(frame);
    } else {
      engine.pause();
      if (shown.current !== frameIndex) engine.preview(frame);
    }
    shown.current = frameIndex;
  }, [engine, running, playing, frameIndex, frames]);

  return {
    status,
    /** El audio ya suena. */
    started: running,
    enable,
    /** Sonido del clic en el mapa: `value` en unidades del dato (null si no hay), `pan` de -1 a 1. */
    ping: (value: number | null, pan: number) => engine.ping(value, pan),
  };
}
