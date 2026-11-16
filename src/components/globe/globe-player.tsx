"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Compass, Hand, LocateFixed, Pause, Play, SkipBack, SkipForward, Smartphone, SquarePlay, Volume2, VolumeX } from "lucide-react";
import { GlobeViewer, type GlobeViewerHandle } from "@/components/globe/globe-viewer";
import { Announce } from "@/components/voice/announce";
import { VoiceSettings } from "@/components/voice/voice-settings";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePlayback } from "@/hooks/use-playback";
import { useRadar } from "@/hooks/use-radar";
import { analyze, classify, RESOLUTIONS, type DiscGrid } from "@/lib/explore/disc";
import { buildDots, drawRadar, type RadarDot } from "@/lib/explore/radar-dots";
import type { GlobeView } from "@/lib/globe";
import { requestOrientationPermission, supportsOrientation } from "@/lib/globe/controls/orientation-permission";
import { GLOBE_ROOT } from "@/lib/globe/routes";
import type { GlobeData } from "@/lib/globe/data";
import type { ControlMode } from "@/lib/globe/types";
import { SECONDS_PER_FRAME, type DataBand } from "@/lib/player";
import { themeStyle } from "@/lib/theme";

/** Segundos finales de cada frame en los que se funde con el siguiente. */
const FADE_SECONDS = 1;
const TILT_STEP = Math.PI / 36; // 5°
const ZOOM_STEP = 0.9;

/** Radio del círculo que suena, en fracción del lado corto de la pantalla (0.3 → 60vmin de diámetro). */
const RADIUS = 0.3;
const DISC = RESOLUTIONS[1];
/** Como mucho, un recálculo del disco cada tantos ms mientras se mueve la cámara. */
const REFRESH_MS = 120;
const NO_BANDS: DataBand[] = [];
const NO_DOTS: RadarDot[] = [];
/**
 * El radar pequeño se dibuja en un lienzo virtual de este tamaño (px) y se escala
 * al canvas: así las bolitas y la flecha guardan las proporciones del radar del reproductor.
 */
const RADAR_BOX = 400;
const RADAR_R = RADAR_BOX / 2 - 8;

const BUTTON = "glass-light inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-white/25";

/**
 * Globo interior a pantalla completa: reproduce los frames de una track en
 * secuencia (con fundido) y deja mirar alrededor arrastrando o, en el móvil,
 * moviendo el teléfono.
 *
 * Suena con el radar del reproductor: gira dentro de un círculo fijo en el centro
 * de la pantalla y toca los niveles del dato que hay en esa zona del planeta. Al
 * mirar a otro sitio (arrastrando o con el giroscopio) suena otra zona.
 */
export function GlobePlayer({ data }: { data: GlobeData }) {
  const { playlist, track, frames, bounds, playerHref, dataScale, dataBands, dataRegion } = data;
  const frameCount = frames.length;
  const duration = frameCount * SECONDS_PER_FRAME;
  const urls = useMemo(() => frames.map((f) => f.url), [frames]);

  const viewer = useRef<GlobeViewerHandle>(null);
  // Con radar, el timelapse arranca a la vez que el sonido; sin él, en cuanto se entra.
  const player = usePlayback(duration, frameCount > 1 && !dataBands);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touch = useMediaQuery("(pointer: coarse)");

  const [mode, setMode] = useState<ControlMode>("drag");
  const [notice, setNotice] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [vol, setVol] = useState(70);
  const [muted, setMuted] = useState(false);

  const t = player.position;
  const index = Math.max(0, Math.min(Math.floor(t / SECONDS_PER_FRAME), frameCount - 1));
  const intoFrame = t - index * SECONDS_PER_FRAME;
  const blend = reducedMotion || frameCount < 2 ? 0 : Math.max(0, Math.min(1, (intoFrame - (SECONDS_PER_FRAME - FADE_SECONDS)) / FADE_SECONDS));
  const frame = frames[index];

  // ---- Radar: lo que hay dentro del círculo fijo, leído sobre el globo ----
  /** Foto de la vista (se renueva al mover la cámara, como mucho cada `REFRESH_MS`). */
  const [view, setView] = useState<GlobeView | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);
  const refreshTimer = useRef<number | undefined>(undefined);

  /** Pide una foto nueva de la vista, agrupando los avisos seguidos (la cámara avisa en cada fotograma). */
  const refreshView = () => {
    if (refreshTimer.current !== undefined) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = undefined;
      setView(viewer.current?.view() ?? null);
    }, REFRESH_MS);
  };
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const grid = frame?.grid ?? null;
  const discGrid = useMemo((): DiscGrid | null => {
    if (!view || !dataBands || !grid) return null;
    // (u, w) es la posición en la pantalla (0–1): se pasa a coordenadas de la vista y de ahí al mapa.
    const sample = (u: number, w: number) => {
      const hit = view.mapAt(2 * u - 1, 1 - 2 * w);
      return hit ? classify(grid, hit.u, hit.v, dataScale, dataBands, dataRegion) : { band: null, value: null };
    };
    return analyze(sample, { u: 0.5, v: 0.5, radius: RADIUS }, view.aspect, DISC.rings, DISC.steps);
  }, [view, grid, dataScale, dataBands, dataRegion]);

  /** Bolitas del radar pequeño: lo mismo que hay dentro del círculo, en el lienzo virtual. */
  const radarDots = useMemo((): RadarDot[] => {
    if (!view || !dataBands || !grid) return NO_DOTS;
    // Pantalla (alto = 1) a escala del radar pequeño: el círculo de la pantalla ocupa todo el radar.
    const k = RADAR_R / (RADIUS * Math.min(view.aspect, 1));
    const width = view.aspect * k;
    const height = k;
    const c = RADAR_BOX / 2;
    return buildDots({
      cx: c,
      cy: c,
      R: RADAR_R,
      map: { left: c - width / 2, top: c - height / 2, width, height },
      // Sobre el globo no se pueden leer los píxeles de la imagen: el color es el del nivel.
      pixels: null,
      sample: (u, w) => {
        const hit = view.mapAt(2 * u - 1, 1 - 2 * w);
        return hit ? classify(grid, hit.u, hit.v, dataScale, dataBands, dataRegion) : { band: null, value: null };
      },
      fallback: (band) => dataBands.bands[band]?.color ?? "#fff",
    });
  }, [view, grid, dataScale, dataBands, dataRegion]);

  // El dibujo corre en cada cuadro (la flecha gira aunque nada más cambie); lee lo último de estas refs.
  const arrowState = useRef<{ pos: number; reach: number }>({ pos: 0, reach: DISC.rings });
  const dotsRef = useRef(radarDots);
  useEffect(() => {
    dotsRef.current = radarDots;
  }, [radarDots]);
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!dataBands || !canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const paint = (ms: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = canvas.clientWidth;
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
      }
      const scale = (size * dpr) / RADAR_BOX;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, RADAR_BOX, RADAR_BOX);
      const { pos, reach } = arrowState.current;
      drawRadar(ctx, {
        cx: RADAR_BOX / 2,
        cy: RADAR_BOX / 2,
        R: RADAR_R,
        dots: dotsRef.current,
        arrow: (2 * Math.PI * pos) / DISC.steps - Math.PI / 2,
        reach: reach / DISC.rings,
        t: ms / 1000,
        still,
      });
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [dataBands]);

  const soundStarted = useRef(false);
  const radar = useRadar({
    active: !!dataBands,
    grid: discGrid,
    bands: dataBands?.bands ?? NO_BANDS,
    volume: muted ? 0 : vol,
    profileId: track.profileId,
    onArrow: (pos, reach) => {
      arrowState.current = { pos, reach };
    },
    onPlayingChange: (on) => {
      // En cuanto el radar suena por primera vez, arranca también el timelapse.
      if (!on || soundStarted.current) return;
      soundStarted.current = true;
      if (frameCount > 1) player.play();
    },
  });

  // ---- Arranque del sonido (el navegador exige un gesto) ----
  /** La persona quiere oír el radar (deja de quererlo al pausar). */
  const [wantSound, setWantSound] = useState(true);

  // Si ya se interactuó con el sitio (se llegó desde el reproductor), suena sin esperar.
  const tryAutoStart = useEffectEvent(() => {
    if (dataBands && navigator.userActivation?.hasBeenActive) radar.start();
  });
  useEffect(() => tryAutoStart(), []);

  // Si no, el primer gesto (arrastrar el globo, una tecla…) lo arranca. Los botones lo hacen ellos mismos.
  const onGesture = useEffectEvent((e: Event) => {
    if (!dataBands || radar.playing || !wantSound) return;
    if ((e.target as HTMLElement | null)?.closest?.("button, a, input")) return;
    radar.start();
  });
  useEffect(() => {
    const handler = (e: Event) => onGesture(e);
    window.addEventListener("pointerup", handler, true);
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("pointerup", handler, true);
      window.removeEventListener("keydown", handler, true);
    };
  }, []);

  /** Play/pausa del timelapse y del radar a la vez. */
  const togglePlay = () => {
    if (player.isPlaying || radar.playing) {
      player.pause();
      radar.stop();
      setWantSound(false);
    } else {
      if (frameCount > 1) player.play();
      setWantSound(true);
      if (dataBands) radar.start();
    }
  };

  const toggleMute = () => {
    setMuted(!muted);
    setAnnouncement(muted ? "Sound on." : "Sound off.");
  };

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
        togglePlay();
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
      case "s":
      case "S":
        toggleMute();
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
  const playing = player.isPlaying || radar.playing;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-sans text-glass" style={themeStyle(track.profileId)}>
      <Announce
        text={`Globe view of ${track.title}. ${frameCount} frames. Drag to look around, or use the arrow keys: left and right change the frame, up and down tilt the view. Press R to recenter.${dataBands ? " A radar turns inside the circle in the middle of the screen and plays the levels of the data it finds there; look somewhere else to hear another region. Press S to mute." : ""}`}
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
          onViewChange={refreshView}
          className="h-full w-full"
        />
      </section>

      {/* Zona que suena: círculo fijo en el centro (el radar gira dentro). */}
      {dataBands && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
        />
      )}

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

      {/* Radar pequeño, fijo arriba a la derecha: lo que hay dentro del círculo y la flecha que lo recorre. */}
      {dataBands && (
        <canvas
          ref={radarCanvasRef}
          aria-hidden
          className="pointer-events-none absolute right-4 top-20 h-24 w-24 rounded-full shadow-2xl ring-1 ring-white/25 md:right-6 md:top-24 md:h-28 md:w-28"
        />
      )}

      {/* Solo si se abrió la URL directamente: el navegador no deja sonar sin un gesto. */}
      {dataBands && !playing && wantSound && frameCount > 0 && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-3 rounded-full bg-white px-6 py-4 text-base font-semibold text-black shadow-2xl transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400"
        >
          <Play className="h-5 w-5 fill-current" aria-hidden /> Play with sound
        </button>
      )}

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
          {!dataBands && <p className="text-[11px] text-glass-muted">This dataset has no levels, so the radar has nothing to play.</p>}

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
                onClick={togglePlay}
                disabled={frameCount === 0}
                aria-label={playing ? "Pause" : "Play"}
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-lg transition hover:scale-105 disabled:opacity-50"
              >
                {playing ? <Pause aria-hidden className="h-5 w-5 fill-current" /> : <Play aria-hidden className="ml-0.5 h-5 w-5 fill-current" />}
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next frame" className="text-glass-muted transition hover:scale-110 hover:text-glass">
                <SkipForward aria-hidden className="h-5 w-5 fill-current" />
              </button>
              {dataBands && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={toggleMute} aria-pressed={muted} aria-label="Mute sound (S)" className="text-glass-muted transition hover:text-glass">
                    {muted ? <VolumeX aria-hidden className="h-4 w-4" /> : <Volume2 aria-hidden className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={vol}
                    onChange={(e) => { setVol(+e.target.value); setMuted(false); }}
                    aria-label="Volume"
                    className="hidden h-1 w-20 accent-white md:block"
                  />
                </div>
              )}
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
