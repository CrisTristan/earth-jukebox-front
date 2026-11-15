"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { speak, stopSpeaking } from "@/lib/voice/speak";

type VoiceContextValue = {
  enabled: boolean;
  toggle: () => void;
  /** Dice el texto si la voz está activada. */
  say: (text: string) => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

// Preferencia guardada por navegador; si localStorage no está disponible, vive en memoria.
const KEY = "earth-jukebox:voice";
const listeners = new Set<() => void>();
let current: boolean | null = null;

function read(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(KEY) !== "off";
    } catch {
      current = true;
    }
  }
  return current;
}

function write(value: boolean) {
  current = value;
  try {
    localStorage.setItem(KEY, value ? "on" : "off");
  } catch {
    // sin almacenamiento: la preferencia dura lo que la pestaña
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(subscribe, read, () => true);

  const toggle = () => {
    const next = !enabled;
    if (!next) stopSpeaking();
    write(next);
    if (next) speak("Voice guide on.");
  };
  const say = (text: string) => {
    if (enabled) speak(text);
  };

  return <VoiceContext value={{ enabled, toggle, say }}>{children}</VoiceContext>;
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) throw new Error("useVoice debe usarse dentro de <VoiceProvider>");
  return context;
}
