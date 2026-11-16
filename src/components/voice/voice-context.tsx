"use client";

import { createContext, useContext, useEffect, useEffectEvent, useSyncExternalStore, type ReactNode } from "react";
import { FocusNarrator } from "@/components/voice/focus-narrator";
import { speak, stopSpeaking } from "@/lib/voice/speak";

/**
 * Niveles de la guía por voz:
 * - `off`: no habla (útil para no duplicar la voz de VoiceOver/TalkBack/NVDA).
 * - `full` (por defecto): anuncia las páginas y lee cada botón o enlace al
 *   navegar con el teclado, con la sección en la que está.
 *
 * La voz del mapa (decir el lugar al hacer clic) es una preferencia aparte: `mapVoice`.
 */
export type VoiceMode = "off" | "full";

export const VOICE_MODES: { value: VoiceMode; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "No voice." },
  { value: "full", label: "Full guide", hint: "Announces pages and reads buttons, links and sections when you press Tab." },
];

type VoiceContextValue = {
  mode: VoiceMode;
  setMode: (mode: VoiceMode) => void;
  /** La guía por voz está encendida. */
  enabled: boolean;
  /** Alterna la guía entre apagada y completa (tecla V). */
  toggle: () => void;
  /** Dice el texto si la guía por voz está encendida. */
  say: (text: string) => void;
  /** Decir el lugar al hacer clic en el mapa (switch "Map voice"). */
  mapVoice: boolean;
  setMapVoice: (on: boolean) => void;
  /** Dice el texto si la voz del mapa está encendida. */
  sayOnMap: (text: string) => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

/**
 * Preferencia guardada por navegador. Si localStorage no está disponible, vive
 * en memoria lo que dure la pestaña.
 */
function createPreference<T>(key: string, parse: (stored: string | null) => T, serialize: (value: T) => string) {
  const listeners = new Set<() => void>();
  let current: { value: T } | null = null;
  return {
    read(): T {
      if (current === null) {
        try {
          current = { value: parse(localStorage.getItem(key)) };
        } catch {
          current = { value: parse(null) };
        }
      }
      return current.value;
    },
    write(value: T) {
      current = { value };
      try {
        localStorage.setItem(key, serialize(value));
      } catch {
        // sin almacenamiento
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Clave anterior ("on"/"off"), cuando la voz solo se podía encender o apagar. */
const LEGACY_KEY = "earth-jukebox:voice";

// Guía completa por defecto: solo se apaga si la persona lo eligió.
const modePref = createPreference<VoiceMode>(
  "earth-jukebox:voice-mode",
  (stored) => {
    // "announcements" era un nivel intermedio que ya no existe.
    if (stored === "full" || stored === "announcements") return "full";
    if (stored === "off") return "off";
    try {
      return localStorage.getItem(LEGACY_KEY) === "off" ? "off" : "full";
    } catch {
      return "full";
    }
  },
  (value) => value,
);

// Encendida por defecto: solo se apaga si la persona lo eligió.
const mapVoicePref = createPreference<boolean>(
  "earth-jukebox:map-voice",
  (stored) => stored !== "off",
  (on) => (on ? "on" : "off"),
);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(modePref.subscribe, modePref.read, () => "full" as const);
  const mapVoice = useSyncExternalStore(mapVoicePref.subscribe, mapVoicePref.read, () => true);
  const enabled = mode === "full";

  const setMode = (next: VoiceMode) => {
    if (next === mode) return;
    modePref.write(next);
    if (next === "off") {
      stopSpeaking();
      speak("Voice guide off.");
    } else {
      speak("Voice guide on. Press Tab to explore the page.");
    }
  };
  const toggle = () => setMode(enabled ? "off" : "full");
  const say = (text: string) => {
    if (enabled) speak(text);
  };

  const setMapVoice = (on: boolean) => {
    if (on === mapVoice) return;
    mapVoicePref.write(on);
    if (!on) stopSpeaking();
    speak(on ? "Map voice on. Click the map to hear the name of the place." : "Map voice off.");
  };
  const sayOnMap = (text: string) => {
    if (mapVoice) speak(text);
  };

  // Atajo global: V enciende o apaga la guía.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "v" && e.key !== "V") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input:not([type=radio]):not([type=range]):not([type=checkbox]), textarea, select, [contenteditable]")) return;
    toggle();
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <VoiceContext value={{ mode, setMode, enabled, toggle, say, mapVoice, setMapVoice, sayOnMap }}>
      {children}
      <FocusNarrator active={enabled} />
    </VoiceContext>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) throw new Error("useVoice debe usarse dentro de <VoiceProvider>");
  return context;
}
