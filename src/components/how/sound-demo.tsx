"use client";

/* eslint-disable @next/next/no-img-element -- los frames se muestran tal cual */

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { noteFor, normalized, Sonifier, type SoundProfile } from "@/lib/sound/sonifier";

export interface DemoFrame {
  url: string;
  label: string;
  features: Record<string, number>;
}

const NOTE_NAMES = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5", "C6"];
const MIDI_OF_STEP = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
/** Segundos por frame en la demo (más rápido que el reproductor: 32 frames en ~1 minuto). */
const SECONDS = 2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Paso 3: suena el timelapse con el motor real y se ve, frame a frame, qué dato
 * mueve cada parte del sonido.
 */
export function SoundDemo({ frames, sound, words }: {
  frames: DemoFrame[];
  sound: SoundProfile;
  words: { subject: string | null; strong: string | null; secondary: string | null };
}) {
  const [engine] = useState(() => new Sonifier(sound));
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const timer = useRef(0);

  useEffect(() => () => {
    window.clearInterval(timer.current);
    engine.dispose();
  }, [engine]);

  const frame = frames[index]!;
  const f = frame.features;
  const melody = clamp01(normalized(sound.melody, f) ?? 0.5);
  const step = Math.round(melody * 10);
  const midi = noteFor(melody);
  const rows = [
    { what: words.subject ? `Average ${words.subject}` : "Average value", to: "Note", v: melody, show: NOTE_NAMES[MIDI_OF_STEP.indexOf(midi)] ?? "" },
    { what: words.strong ?? "Intensity", to: "Texture", v: clamp01(normalized(sound.intensity, f) ?? 0), show: "" },
    { what: words.secondary ?? "Secondary", to: "Bells", v: clamp01(normalized(sound.secondary, f) ?? 0), show: "" },
    { what: "Highest values", to: "Brightness", v: clamp01(normalized(sound.brightness, f) ?? 0.5), show: "" },
    { what: "Center of the data", to: "Left / right", v: clamp01(((f.centroid_lon ?? 0) + 180) / 360), show: (f.centroid_lon ?? 0) < -20 ? "left" : (f.centroid_lon ?? 0) > 20 ? "right" : "center" },
  ];

  const playFrame = (i: number) => {
    const fr = frames[i]!;
    engine.play({ features: fr.features, land: null });
  };

  const toggle = async () => {
    if (playing) {
      window.clearInterval(timer.current);
      engine.pause();
      setPlaying(false);
      return;
    }
    // Dentro del clic: el navegador deja crear el audio.
    if (!(await engine.start())) return;
    engine.setPreset("Pulsing");
    engine.setVolume(70);
    setPlaying(true);
    playFrame(index);
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % frames.length;
        playFrame(next);
        return next;
      });
    }, SECONDS * 1000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="relative aspect-[2/1] overflow-hidden rounded-lg bg-black ring-1 ring-white/15">
          {frames.map((fr, i) => (
            <img key={fr.url} src={fr.url} alt={i === index ? `Frame ${i + 1} of ${frames.length}` : ""} aria-hidden={i !== index} loading="lazy"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`} />
          ))}
          <button type="button" onClick={() => void toggle()} aria-label={playing ? "Pause the demo" : "Play the demo with sound"}
            className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-2xl transition hover:scale-105">
            {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
          </button>
          <p className="glass-light absolute right-3 top-3 rounded-md bg-black/55 px-3 py-1 text-xs tabular-nums">Frame {index + 1}/{frames.length}</p>
        </div>
        {/* Progreso: cada frame es un escalón con la altura de su nota */}
        <div className="flex h-14 items-end gap-0.5" aria-hidden>
          {frames.map((fr, i) => {
            const s = Math.round(clamp01(normalized(sound.melody, fr.features) ?? 0.5) * 10);
            return (
              <span key={fr.url} className="flex-1 rounded-t transition-colors duration-500"
                style={{ height: `${18 + s * 8}%`, background: i === index ? "var(--accent)" : i < index ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.12)" }} />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Escalera de notas */}
        <p className="sr-only" aria-live="polite">{playing ? `Frame ${index + 1}, note ${rows[0]!.show}` : ""}</p>
        <div className="glass rounded-lg p-4" aria-hidden>
          <p className="text-xs uppercase tracking-widest text-glass-muted">The note you hear</p>
          <div className="mt-3 flex items-end gap-1">
            {NOTE_NAMES.map((n, k) => (
              <div key={n} className="flex flex-1 flex-col items-center gap-1">
                <span className="w-full rounded-md transition-all duration-500"
                  style={{ height: `${12 + k * 5}px`, background: k === step ? "var(--accent)" : "rgba(255,255,255,.12)", boxShadow: k === step ? "0 0 18px var(--accent)" : "none" }} />
                <span className={`text-[10px] tabular-nums ${k === step ? "text-glass" : "text-glass-muted"}`}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Qué dato mueve qué parte del sonido */}
        <ul className="glass space-y-3 rounded-lg p-4">
          {rows.map((r) => (
            <li key={r.to}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-glass-muted">{r.what}</span>
                <span className="shrink-0 font-semibold">→ {r.to}{r.show ? ` · ${r.show}` : ""}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-700" style={{ width: `${Math.round(r.v * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
