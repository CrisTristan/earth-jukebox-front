"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Compass, Hand, LocateFixed, Pause, Play, SkipBack, SkipForward, Smartphone, SquarePlay } from "lucide-react";
import { GlobeViewer, type GlobeViewerHandle } from "@/components/globe/globe-viewer";
import { Announce } from "@/components/voice/announce";
import { VoiceSettings } from "@/components/voice/voice-settings";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePlayback } from "@/hooks/use-playback";
import { requestOrientationPermission, supportsOrientation } from "@/lib/globe/controls/orientation-permission";
import { GLOBE_ROOT } from "@/lib/globe/routes";
import type { GlobeData } from "@/lib/globe/data";
import type { ControlMode } from "@/lib/globe/types";
import { SECONDS_PER_FRAME } from "@/lib/player";
import { themeStyle } from "@/lib/theme";

/** Segundos finales de cada frame en los que se funde con el siguiente. */
const FADE_SECONDS = 1;
const TILT_STEP = Math.PI / 36; // 5°
const ZOOM_STEP = 0.9;

const BUTTON = "glass-light inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-white/25";

/**
 * Globo interior a pantalla completa: reproduce los frames de una track en
 * secuencia (con fundido) y deja mirar alrededor arrastrando o, en el móvil,
 * moviendo el teléfono.
 */
export function GlobePlayer({ data }: { data: GlobeData }) {
  const { playlist, track, frames, bounds, playerHref } = data;
  const frameCount = frames.length;
  const duration = frameCount * SECONDS_PER_FRAME;
  const urls = useMemo(() => frames.map((f) => f.url), [frames]);

  const viewer = useRef<GlobeViewerHandle>(null);
  const player = usePlayback(duration, frameCount > 1);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touch = useMediaQuery("(pointer: coarse)");

  const [mode, setMode] = useState<ControlMode>("drag");
  const [notice, setNotice] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const t = player.position;
  const index = Math.max(0, Math.min(Math.floor(t / SECONDS_PER_FRAME), frameCount - 1));
  const intoFrame = t - index * SECONDS_PER_FRAME;
  const blend = reducedMotion || frameCount < 2 ? 0 : Math.max(0, Math.min(1, (intoFrame - (SECONDS_PER_FRAME - FADE_SECONDS)) / FADE_SECONDS));
  const frame = frames[index];

  const step = (delta: number) => {
    if (frameCount === 0) return;
    const next = (index + delta + frameCount) % frameCount;
    player.seek(next * SECONDS_PER_FRAME);
    setAnnouncement(`${frames[next].label}, frame ${next + 1} of ${frameCount}`);
  };

  const enableMotion = async () => {
    setNotice("");
    if (!supportsOrientation() || !window.isSecureContext) {
      setNotice("Motion needs a phone or tablet and a secure (https) connection.");
      return;
    }
    if (await requestOrientationPermission()) {
      setMode("orientation");
      setAnnouncement("Motion on. Turn around with your phone to look inside the globe.");
    } else {
      setNotice("Motion access was denied. You can still drag to look around.");
    }
  };

  const switchToDrag = () => {
    setMode("drag");
    setNotice("");
    setAnnouncement("Motion off. Drag to look around.");
  };

  // ---- Atajos de teclado ----
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    const onInteractive = !!target?.closest("button, a");
    switch (e.key) {
      case " ":
        if (onInteractive) return;
        player.toggle();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        step(e.key === "ArrowLeft" ? -1 : 1);
        break;
      case "ArrowUp":
      case "ArrowDown":
        viewer.current?.rotateBy(0, e.key === "ArrowUp" ? TILT_STEP : -TILT_STEP);
        break;
      case "+":
      case "=":
        viewer.current?.zoomBy(ZOOM_STEP);
        break;
      case "-":
      case "_":
        viewer.current?.zoomBy(1 / ZOOM_STEP);
        break;
      case "r":
      case "R":
        viewer.current?.recenter();
        break;
      default:
        return;
    }
    e.preventDefault();
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-sans text-glass" style={themeStyle(track.profileId)}>
      <Announce
        text={`Globe view of ${track.title}. ${frameCount} frames. Drag to look around, or use the arrow keys: left and right change the frame, up and down tilt the view. Press R to recenter.`}
      />
      <p aria-live="polite" className="sr-only">{announcement}</p>

      <section data-voice-section="Globe" className="absolute inset-0">
        <GlobeViewer
          ref={viewer}
          urls={urls}
          bounds={bounds}
          index={index}
          blend={blend}
          controlMode={mode}
          label={`Inside view of ${track.title}${frame ? `, ${frame.label}` : ""}`}
          onOrientationUnavailable={() => {
            setMode("drag");
            setNotice("No motion sensor found on this device. Drag to look around.");
          }}
          className="h-full w-full"
        />
      </section>

      {/* ---- Barra superior ---- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-linear-to-b from-black/60 to-transparent p-4 md:p-6">
        <div className="pointer-events-auto flex min-w-0 items-start gap-3">
          <Link href={GLOBE_ROOT} aria-label="All globes" className="glass-light grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-white/25">
            <ArrowLeft aria-hidden className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-widest text-glass-muted">{playlist.title}</p>
            <h1 className="truncate font-display text-2xl leading-tight md:text-4xl">{track.title}</h1>
          </div>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <Link href={playerHref} className={BUTTON}>
            <SquarePlay aria-hidden className="h-4 w-4" /> <span className="hidden sm:inline">Open in player</span>
            <span className="sr-only sm:hidden">Open in player</span>
          </Link>
          <VoiceSettings variant="icon" className="glass-light rounded-full p-2" />
        </div>
      </header>

      {notice && (
        <p role="status" className="glass absolute left-1/2 top-24 w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm">
          {notice}
        </p>
      )}

      {/* ---- Controles ---- */}
      <footer
        data-voice-section="Globe controls"
        className="absolute inset-x-0 bottom-0 flex justify-center bg-linear-to-t from-black/70 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-6"
      >
        <div className="glass flex w-full max-w-3xl flex-col gap-3 rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm">
              <span className="font-semibold">{frame?.label ?? "No frames"}</span>
              {frameCount > 0 && <span className="text-glass-muted"> · {index + 1} / {frameCount}</span>}
            </p>
            <p className="hidden items-center gap-1.5 text-[11px] text-glass-muted sm:flex">
              {mode === "orientation" ? <Compass aria-hidden className="h-3.5 w-3.5" /> : <Hand aria-hidden className="h-3.5 w-3.5" />}
              {mode === "orientation" ? "Move your phone to look around" : "Drag to look around · scroll to zoom"}
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] tabular-nums text-glass-muted">
            <span>{fmt(t)}</span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={Math.min(t, duration)}
              onChange={(e) => player.seek(+e.target.value)}
              aria-label="Seek"
              aria-valuetext={frame ? `${frame.label}, frame ${index + 1} of ${frameCount}` : undefined}
              className="h-1 flex-1 cursor-pointer accent-[var(--accent,#fff)]"
            />
            <span>{fmt(duration)}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => step(-1)} aria-label="Previous frame" className="text-glass-muted transition hover:scale-110 hover:text-glass">
                <SkipBack aria-hidden className="h-5 w-5 fill-current" />
              </button>
              <button
                type="button"
                onClick={player.toggle}
                disabled={frameCount === 0}
                aria-label={player.isPlaying ? "Pause" : "Play"}
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-lg transition hover:scale-105 disabled:opacity-50"
              >
                {player.isPlaying ? <Pause aria-hidden className="h-5 w-5 fill-current" /> : <Play aria-hidden className="ml-0.5 h-5 w-5 fill-current" />}
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next frame" className="text-glass-muted transition hover:scale-110 hover:text-glass">
                <SkipForward aria-hidden className="h-5 w-5 fill-current" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => viewer.current?.recenter()} className={BUTTON}>
                <LocateFixed aria-hidden className="h-4 w-4" /> Recenter
              </button>
              {touch && (mode === "orientation" ? (
                <button type="button" onClick={switchToDrag} className={BUTTON}>
                  <Hand aria-hidden className="h-4 w-4" /> Use touch
                </button>
              ) : (
                <button type="button" onClick={enableMotion} className={BUTTON}>
                  <Smartphone aria-hidden className="h-4 w-4" /> Enable motion
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
