"use client";

/* eslint-disable @next/next/no-img-element -- los frames se muestran tal cual, con object-contain y fundido */

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Info, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, AudioWaveform, ChevronRight, ChevronDown, ChevronUp, Satellite, ListMusic, Disc3,
} from "lucide-react";
import { useRadar } from "@/hooks/use-radar";
import { analyze, originText, RESOLUTIONS, type Cell } from "@/lib/explore/disc";
import { VOICES } from "@/lib/explore/explorer";
import { useDrawerSwipe } from "@/hooks/use-drawer-swipe";
import { MOBILE_LANDSCAPE, useMediaQuery } from "@/hooks/use-media-query";
import { Announce } from "@/components/voice/announce";
import { useVoice } from "@/components/voice/voice-context";
import { VoiceSettings } from "@/components/voice/voice-settings";
import { usePlayback } from "@/hooks/use-playback";
import { useSonification } from "@/hooks/use-sonification";
import { loadCountries, placeAt, type CountryShape } from "@/lib/geo/places";
import { globeAt, hasGlobeCameras } from "@/lib/geo/globe";
import { containedRect, gridValue, toGeo, type DataRegion } from "@/lib/geo/projection";
import { SECONDS_PER_FRAME, type DataBand, type DataBands, type PlayerData, type PlayerFrame, type PlayerMeter } from "@/lib/player";

const NO_BANDS: DataBand[] = [];

/** Texto del radar para la voz: los símbolos se dicen en palabras ("≥ 200" → "at least 200"). */
const speakable = (text: string) =>
  text.replace(/≥\s*/g, "at least ").replace(/<\s*/g, "below ").replace(/(\d)–(-?\d)/g, "$1 to $2");
import { LAYER_MODES, PRESETS, type LayerMode, type Preset } from "@/lib/sound/sonifier";
import { paletteFor } from "@/lib/sound/palettes";
import { themeStyle } from "@/lib/theme";

const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["← →", "Previous / next frame"],
  ["S", "Sound on / off"],
  ["E", "Explore: a radar follows the pointer and plays the data levels around it"],
  ["Explore", "Arrows move the radar, Enter or click says the place and its level, Space pauses it, + and − change its size"],
  ["D", "Describe the current frame"],
  ["Click", "Hear the place and its value on the map"],
  ["V", "Voice guide on / off"],
  ["M", "Map voice on / off"],
  ["Esc", "Close panels"],
] as const;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fmtValue = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
const norm = (m: PlayerMeter, v: number | undefined) =>
  v == null ? 0 : m.max - m.min < 1e-9 ? 0.5 : Math.max(0, Math.min(1, (v - m.min) / (m.max - m.min)));

interface Sampler {
  frame: PlayerFrame;
  /** Slug del globo (con cámaras por frame) o null si es un mapa plano. */
  globe: string | null;
  aspect: number;
  scale: PlayerData["dataScale"];
  levels: DataBands;
  /** Recuadro de la imagen que cubre la cuadrícula del motor. */
  region: DataRegion;
}

/**
 * Qué hay en (u, v) de la imagen del frame, solo según el dato: el nivel en que
 * cae su valor (umbrales del dataset) y el valor normalizado (percentiles 5–95).
 * Sin dato, fuera del mapa o fuera del planeta: `band: null` (silencio). En los
 * datasets donde la falta de dato es cero (lluvia, rayos) cuenta como el nivel más bajo.
 */
function sampleFrame(s: Sampler, u: number, v: number): Cell {
  const none = { band: null, value: null };
  if (u < 0 || u > 1 || v < 0 || v > 1) return none;
  if (s.globe) {
    const hit = globeAt(s.globe, s.frame.id, u, v, s.aspect);
    if (!hit || hit === "space") return none;
  }
  const raw = gridValue(s.frame.grid, u, v, s.region);
  if (raw == null) return s.levels.missingIsZero && s.frame.grid ? { band: 0, value: 0 } : none;
  const sc = s.scale;
  const value = sc ? Math.max(0, Math.min(1, (raw - sc.low) / (sc.top - sc.low))) : null;
  return { band: s.levels.cuts.filter((c) => raw >= c).length, value };
}

export function TrackPlayer({ data }: { data: PlayerData }) {
  const { playlist, tracks, track, frames, meters } = data;
  const frameCount = frames.length;
  const duration = frameCount * SECONDS_PER_FRAME;

  const [info, setInfo] = useState(false);
  const [synthOpen, setSynthOpen] = useState(false);
  const [synth, setSynth] = useState<Preset>("Ambient");
  const [layers, setLayers] = useState<LayerMode>("Nature + music");
  const [vol, setVol] = useState(70);
  const [muted, setMuted] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // ---- Explorar (disco de "Capas de la Tierra") ----
  const [explore, setExplore] = useState(false);
  const [origin, setOrigin] = useState({ u: 0.5, v: 0.5 });
  const [radius, setRadius] = useState(0.45);
  /** Rectángulo del mapa dentro del escenario (px), para dibujar los anillos encima. */
  const [mapBox, setMapBox] = useState<{ left: number; top: number; width: number; height: number; aspect: number } | null>(null);
  const arrowRef = useRef<SVGLineElement>(null);
  const arrowState = useRef({ pos: 0, reach: 6 });
  const [discReach, setDiscReach] = useState(6);

  const voice = useVoice();
  const palette = paletteFor(track.profileId);

  // ---- Móvil en horizontal: controles superpuestos que se esconden deslizándolos ----
  const land = useMediaQuery(MOBILE_LANDSCAPE);
  const [controlsOpen, setControlsOpen] = useState(true);
  const controlsRef = useRef<HTMLDivElement>(null);
  /** Y donde empezó un toque sobre el asa "mostrar" (para detectar el deslizamiento hacia arriba). */
  const showStartY = useRef<number | null>(null);
  const controlsSwipe = useDrawerSwipe(controlsRef, { axis: "y", hideSign: 1, open: controlsOpen, onChange: setControlsOpen, enabled: land });

  const stageRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLSpanElement>(null);
  const countriesRef = useRef<CountryShape[] | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);

  // No arranca solo: empieza a la vez que el sonido, para que la barra nunca avance en silencio.
  const player = usePlayback(duration);
  const playing = player.isPlaying;
  const t = player.position;

  const current = Math.max(0, Math.min(Math.floor(t / SECONDS_PER_FRAME), frameCount - 1));
  const frame = frames[current];
  const sound = useSonification(data.sound, frames, current, playing, { volume: muted ? 0 : vol, layers, preset: synth });

  // En cuanto el audio suena (al entrar, o tras el primer gesto), arranca la reproducción una vez.
  const autoStarted = useRef(false);
  const startWithSound = useEffectEvent(() => {
    if (autoStarted.current || frameCount === 0) return;
    autoStarted.current = true;
    player.play();
  });
  useEffect(() => {
    if (sound.started) startWithSound();
  }, [sound.started]);
  const trackIndex = tracks.findIndex((x) => x.slug === track.slug);
  const prevTrack = trackIndex > 0 ? tracks[trackIndex - 1] : undefined;
  const nextTrack = trackIndex >= 0 ? tracks[trackIndex + 1] : undefined;
  const trackHref = (slug: string) => `/playlists/${playlist.slug}/${slug}`;

  const describe = (i: number) => {
    const f = frames[i];
    if (!f) return "";
    const parts = meters
      .filter((m) => f.features[m.feature] != null)
      .map((m) => `${m.label} ${fmtValue(f.features[m.feature]!)}`);
    if (f.topRegion) parts.push(`highest in ${f.topRegion.name}`);
    return `${f.label}, frame ${i + 1} of ${frameCount}${parts.length ? `: ${parts.join(", ")}` : ""}`;
  };

  const step = (delta: number) => {
    if (frameCount === 0) return;
    const next = (current + delta + frameCount) % frameCount;
    player.seek(next * SECONDS_PER_FRAME);
    setAnnouncement(describe(next));
  };

  // ---- Nombres de lugares (para el clic en el mapa) ----
  useEffect(() => {
    let alive = true;
    loadCountries()
      .then((c) => { if (alive) countriesRef.current = c; })
      .catch(() => { /* sin fronteras: el clic avisa de que el mapa no está listo */ });
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /** En los globos la cámara se mueve: cada frame tiene su cámara calibrada. */
  const globe = hasGlobeCameras(track.slug);

  /**
   * Punto de pantalla → lon/lat sobre el frame actual, o null si cae fuera de la
   * imagen. En un globo, `"space"` si cae fuera del planeta y `"unknown"` si el
   * frame no tiene cámara.
   */
  const mapRect = () => {
    const img = stageRef.current?.querySelector("img");
    if (!img) return null;
    // El padding cambia según el ancho (0 en móvil, `md:p-6` en escritorio).
    const padding = parseFloat(getComputedStyle(img).paddingLeft) || 0;
    return containedRect(img.getBoundingClientRect(), padding, img.naturalWidth, img.naturalHeight);
  };

  /** `u`/`v`: posición en la imagen (0–1), que es también la de la cuadrícula del motor. */
  const geoAt = (x: number, y: number): { lon: number; lat: number; u: number; v: number } | "space" | "unknown" | null => {
    const map = mapRect();
    if (!map) return null;
    const point = toGeo(x, y, map, track.latRange, track.lonRange);
    if (!point || !globe) return point;
    // Globo: rayo desde la cámara calibrada del frame actual hasta la esfera.
    const f = frames[current];
    if (!f || !map.height) return "unknown";
    const hit = globeAt(track.slug, f.id, point.u, point.v, map.width / map.height);
    return hit === null ? "unknown" : hit === "space" ? hit : { ...hit, u: point.u, v: point.v };
  };

  // ---- Explorar: qué hay en cada punto de la imagen del frame actual ----
  const aspect = mapBox?.aspect ?? 2;
  const res = RESOLUTIONS[1];
  const levels = data.dataBands;
  const sampler = explore && frame && levels
    ? { frame, globe: globe ? track.slug : null, aspect, scale: data.dataScale, levels, region: track.dataRegion }
    : null;
  const discGrid = useMemo(() => {
    if (!sampler || (sampler.globe && globeAt(sampler.globe, sampler.frame.id, 0.5, 0.5, sampler.aspect) === null)) return null;
    return analyze((u, v) => sampleFrame(sampler, u, v), { ...origin, radius }, sampler.aspect, res.rings, res.steps);
    // `sampler` se recrea en cada render; lo que cambia de verdad son estas dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explore, frame, globe, aspect, origin, radius, res, levels]);
  const discUnavailable = !levels ? "This dataset has no levels to explore."
    : !frame?.grid ? "This frame has no data to explore."
      : !discGrid ? "The globe's camera isn't calibrated for this frame, so the radar can't read it. Try another frame." : null;
  const discOriginText = discGrid && sampler && levels ? originText(discGrid, sampleFrame(sampler, origin.u, origin.v), levels.bands) : null;

  const measureMap = () => {
    const stage = stageRef.current?.getBoundingClientRect();
    const img = stageRef.current?.querySelector("img");
    const map = mapRect();
    if (!stage || !map || !img?.naturalWidth) return;
    const next = { left: map.left - stage.left, top: map.top - stage.top, width: map.width, height: map.height, aspect: img.naturalWidth / img.naturalHeight };
    // Solo si cambió: este efecto corre en cada render.
    setMapBox((prev) => (prev && (Object.keys(next) as (keyof typeof next)[]).every((k) => Math.abs(prev[k] - next[k]) < 0.5) ? prev : next));
  };
  useEffect(() => {
    if (!explore) return;
    measureMap();
    window.addEventListener("resize", measureMap);
    return () => window.removeEventListener("resize", measureMap);
  });

  /** Flecha del disco dibujada también sobre el mapa. */
  const drawArrow = (pos: number, reach: number) => {
    arrowState.current = { pos, reach };
    if (reach !== discReach) setDiscReach(reach);
    const line = arrowRef.current;
    if (!line || !mapBox) return;
    const R = radius * Math.min(mapBox.width, mapBox.height) * (reach / res.rings);
    const a = (2 * Math.PI * pos) / res.steps - Math.PI / 2;
    const cx = mapBox.left + origin.u * mapBox.width;
    const cy = mapBox.top + origin.v * mapBox.height;
    line.setAttribute("x2", String(cx + R * Math.cos(a)));
    line.setAttribute("y2", String(cy + R * Math.sin(a)));
  };
  useEffect(() => drawArrow(arrowState.current.pos, arrowState.current.reach));

  const moveOrigin = (u: number, v: number) => setOrigin({ u: Math.max(0.02, Math.min(0.98, u)), v: Math.max(0.02, Math.min(0.98, v)) });

  // ---- Radar: suena alrededor del origen, sin interfaz visual propia ----
  const radar = useRadar({ active: explore, grid: discGrid, bands: levels?.bands ?? NO_BANDS, volume: muted ? 0 : vol, profileId: track.profileId, onArrow: drawArrow });

  /** Dice algo del radar: en la región aria-live (lectores de pantalla) y con la voz del mapa. */
  const sayRadar = (text: string) => {
    setAnnouncement(text);
    voice.sayOnMap(speakable(text));
  };

  /** Entra o sale del modo explorar. Al entrar se pausa el timelapse y el radar empieza a sonar. */
  const toggleExplore = () => {
    if (explore) {
      radar.stop();
      setExplore(false);
      sayRadar("Explore off.");
      return;
    }
    player.pause();
    setInfo(false);
    setExplore(true);
    radar.start(); // dentro del gesto (clic o tecla E): crea el audio
    const scale = levels?.bands.map((b) => `${b.name} (${b.range}) sounds like ${VOICES[b.voice]!.toLowerCase()}`).join("; ");
    sayRadar(
      `Explore on. The radar turns around the pointer and plays the levels of ${track.listening.subject ?? "the data"} it finds. ` +
        `Move the pointer over the map or use the arrow keys to move it. Click, or press Enter, to hear the place and its level. ` +
        `Space pauses, plus and minus change its size, E or Escape exits. ` +
        (scale ? `Levels: ${scale}.` : "") +
        (discUnavailable ? ` ${discUnavailable}` : ""),
    );
  };

  // Al entrar, el foco va al mapa para que las flechas muevan el radar.
  useEffect(() => {
    if (explore) stageRef.current?.focus();
  }, [explore]);

  /**
   * Lo que se dice al hacer clic (o Enter) con el radar: el lugar bajo el origen y el
   * nivel del dato ahí. Al moverlo no se dice nada; solo suena.
   */
  const placeAtPoint = (u: number, v: number): string => {
    if (!frame) return "No data here.";
    const countries = countriesRef.current;
    let lon: number;
    let lat: number;
    if (globe) {
      const hit = globeAt(track.slug, frame.id, u, v, aspect);
      if (hit === null) return "Place names are not available for this frame.";
      if (hit === "space") return "Space, outside the planet.";
      ({ lon, lat } = hit);
    } else {
      lon = track.lonRange[0] + u * (track.lonRange[1] - track.lonRange[0]);
      lat = track.latRange[0] + v * (track.latRange[1] - track.latRange[0]);
    }
    const place = countries ? placeAt(countries, lon, lat).spoken : "The map is still loading";
    const raw = gridValue(frame.grid, u, v, track.dataRegion);
    const cell = sampler ? sampleFrame(sampler, u, v) : null;
    const band = cell?.band != null ? levels?.bands[cell.band] : undefined;
    if (raw == null) return `${place}. ${band ? `${band.name}.` : "No data here."}`;
    const value = `${fmtValue(raw)}${track.unit ? ` ${track.unit}` : ""}`;
    return `${place}: ${band ? `${band.name}, ` : ""}${value}.`;
  };

  const onStageKeyDown = (e: React.KeyboardEvent) => {
    if (!explore) return;
    const m = ({ ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.03], ArrowDown: [0, 0.03] } as Record<string, [number, number]>)[e.key];
    if (m) {
      e.preventDefault();
      moveOrigin(origin.u + m[0], origin.v + m[1]);
    } else if (e.key === "Enter") {
      // Como el clic: decir dónde está el radar.
      e.preventDefault();
      sayRadar(placeAtPoint(origin.u, origin.v));
    } else if (e.key === " ") {
      e.preventDefault();
      const wasPlaying = radar.playing;
      void radar.toggle();
      sayRadar(wasPlaying ? "Radar paused." : "Radar playing.");
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      const r = Math.max(0.12, Math.min(0.7, radius + (e.key === "-" ? -0.03 : 0.03)));
      setRadius(r);
      sayRadar(`Radar size: ${Math.round(r * 100)} percent.`);
    }
  };

  // ---- Atajos de teclado ----
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("input, textarea, select")) return;
    const k = e.key;
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;
    // Con el foco en el mapa explorando, las flechas, Espacio y +/- son del radar (`onStageKeyDown`).
    const inExplore = !!target?.closest("[data-explore]");
    const onInteractive = !!target?.closest("button, a");
    if ((k === "e" || k === "E") && plain) {
      toggleExplore();
    } else if ((k === "m" || k === "M") && plain) {
      voice.setMapVoice(!voice.mapVoice);
    } else if ((k === "s" || k === "S") && plain) {
      setMuted(!muted);
      setAnnouncement(muted ? "Sound on." : "Sound off.");
    } else if (k === "Escape") {
      setInfo(false);
      setSynthOpen(false);
      if (explore) toggleExplore();
    } else if (inExplore) {
      return;
    } else if (k === " " && !onInteractive) {
      e.preventDefault();
      player.toggle();
    } else if (k === "d" || k === "D") {
      setAnnouncement(describe(current));
    } else if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      step(k === "ArrowLeft" ? -1 : 1);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** El cursor se atenúa fuera del mapa. */
  const updateCursor = () => {
    rafRef.current = 0;
    const p = pointerRef.current;
    if (!p || !cursorRef.current) return;
    const geo = geoAt(p.x, p.y);
    cursorRef.current.style.opacity = typeof geo === "object" && geo ? "1" : "0.45";
  };

  const onStageMove = (e: React.PointerEvent<HTMLElement>) => {
    const stage = stageRef.current;
    if (e.pointerType === "mouse" && stage && cursorRef.current) {
      const rect = stage.getBoundingClientRect();
      cursorRef.current.style.transform = `translate3d(${e.clientX - rect.left}px, ${e.clientY - rect.top}px, 0)`;
    }
    pointerRef.current = { x: e.clientX, y: e.clientY };
    rafRef.current ||= requestAnimationFrame(updateCursor);
    if (explore) {
      // Explorando: el origen del radar sigue al cursor sobre el mapa (fuera de él se queda donde estaba).
      const map = mapRect();
      if (map && map.width && map.height) {
        const u = (e.clientX - map.left) / map.width;
        const v = (e.clientY - map.top) / map.height;
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) moveOrigin(u, v);
      }
    }
  };

  const onStageLeave = () => {
    if (cursorRef.current) cursorRef.current.style.opacity = "0";
    pointerRef.current = null;
  };

  const onStageClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    cursorDotRef.current?.animate([{ scale: "1" }, { scale: "1.9" }, { scale: "1" }], { duration: 280, easing: "ease-out" });
    if (explore) {
      // Explorando: el clic fija el radar ahí y dice el lugar y el nivel del dato.
      const map = mapRect();
      if (!map || !map.width || !map.height) return;
      const u = (e.clientX - map.left) / map.width;
      const v = (e.clientY - map.top) / map.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return;
      moveOrigin(u, v);
      sayRadar(placeAtPoint(u, v));
      return;
    }
    const geo = geoAt(e.clientX, e.clientY);
    if (!geo) return;
    const countries = countriesRef.current;
    let text: string;
    if (geo === "space") text = "Space, outside the planet.";
    else if (geo === "unknown") text = "Place names are not available for this frame.";
    else {
      // Valor del dato en ese punto: la cuadrícula del motor cubre la imagen entera.
      const value = frame ? gridValue(frame.grid, geo.u, geo.v, track.dataRegion) : null;
      sound.ping(value, Math.max(-1, Math.min(1, geo.u * 2 - 1)));
      const place = countries ? placeAt(countries, geo.lon, geo.lat).spoken : "The map is still loading, try again in a moment.";
      text = value != null && countries ? `${place}: ${fmtValue(value)}${track.unit ? ` ${track.unit}` : ""}.` : place;
    }
    setAnnouncement(text);
    voice.sayOnMap(text);
  };

  return (
    <div className="relative min-h-screen font-sans text-glass overflow-hidden" style={themeStyle(track.profileId)}>
      <div className="jb-bg" />
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <Announce
        text={`Now playing ${track.title}, from the playlist ${playlist.title}. The sound follows the data: a higher note means a higher value. Press S to turn the sound on or off. Click the map to hear the place and its value; press M to turn that voice on or off.`}
      />

      <div className="jb-enter flex h-dvh flex-col md:gap-4 md:p-4 land:gap-0 land:p-0">
        <div className="flex min-h-0 flex-1 md:gap-4 land:gap-0">
          {/* Sidebar solo en escritorio; en móvil horizontal no se muestra. */}
          <aside className="glass hidden md:flex w-1/4 max-w-xs flex-col rounded-3xl p-5 land:hidden">
            <Link href={`/playlists/${playlist.slug}`} className="glass-light flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm">
              <ArrowLeft className="h-4 w-4" /> Playlist
            </Link>
            <p className="mt-6 text-xs uppercase tracking-widest text-glass-muted">Playlist</p>
            <p className="mt-1 font-display text-3xl leading-tight">{playlist.title}</p>
            <nav className="mt-4 space-y-1" aria-label="Tracks" data-voice-section="Track list">
              <button onClick={() => setInfo(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-glass-muted transition hover:bg-white/10 hover:text-glass">
                <Info className="h-4 w-4" /> Track info
              </button>
              {tracks.length > 1 && tracks.map((x) => (
                <Link key={x.slug} href={trackHref(x.slug)} aria-current={x.slug === track.slug ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${x.slug === track.slug ? "bg-white/15 text-glass" : "text-glass-muted hover:bg-white/10 hover:text-glass"}`}>
                  <ListMusic className="h-4 w-4 shrink-0" /> <span className="truncate">{x.title}</span>
                </Link>
              ))}
            </nav>
            <p className="mt-6 mb-3 px-3 text-xs uppercase tracking-widest text-glass-muted">Frames</p>
            <div data-voice-section="Frames list" className="jb-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-1.5">
              {frames.map((f, i) => {
                const lead = meters[0];
                const leadValue = lead ? f.features[lead.feature] : undefined;
                return (
                  <button key={f.id} onClick={() => step(i - current)}
                    aria-current={i === current ? "true" : undefined}
                    aria-label={describe(i)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-1.5 text-left transition ${i === current ? "bg-white/20 border border-white/25" : "border border-transparent hover:bg-white/10"}`}>
                    <img src={f.url} alt="" loading="lazy" className="h-10 w-14 rounded-xl bg-black object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{f.label}</p>
                      <p className="truncate text-xs text-glass-muted">
                        {lead && leadValue != null ? `${lead.label}: ${fmtValue(leadValue)}` : f.topRegion?.name ?? f.id}
                      </p>
                    </div>
                    {i === current && <ChevronRight className="h-4 w-4 text-glass-muted" />}
                  </button>
                );
              })}
            </div>
          </aside>

          <section ref={stageRef} data-voice-section="Map" onPointerMove={onStageMove} onPointerLeave={onStageLeave} onClick={onStageClick}
            onKeyDown={onStageKeyDown} data-explore={explore ? "" : undefined}
            {...(explore ? { tabIndex: 0, role: "application", "aria-label": `Map radar. Move the pointer or use the arrow keys to move it; Space pauses; plus and minus change its size; E exits. ${discOriginText ?? discUnavailable ?? ""}` } : {})}
            className="glass relative flex-1 cursor-none overflow-hidden rounded-3xl bg-black/60 focus-visible:outline-4 focus-visible:outline-amber-300 max-md:rounded-none max-md:border-0 land:fixed land:inset-0 land:rounded-none land:border-0">
            {/* Timelapse: todos los frames apilados; el actual se muestra con fundido. */}
            {frames.map((f, i) => (
              <img key={f.id} src={f.url}
                alt={i === current ? `${track.imageLabel ?? track.title}, ${f.label} (frame ${i + 1} of ${frameCount})` : ""}
                aria-hidden={i !== current}
                className={`absolute inset-0 h-full w-full object-contain md:p-6 land:p-0 transition-opacity duration-1000 ${i === current ? "opacity-100" : "opacity-0"}`} />
            ))}
            {frameCount === 0 && (
              <p className="absolute inset-0 grid place-items-center text-glass-muted">This track has no frames.</p>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* Explorar: anillos alrededor del origen y la flecha del disco, sobre el mapa. */}
            {explore && mapBox && (() => {
              const cx = mapBox.left + origin.u * mapBox.width;
              const cy = mapBox.top + origin.v * mapBox.height;
              const R = radius * Math.min(mapBox.width, mapBox.height);
              const reach = discReach;
              return (
                <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full">
                  {Array.from({ length: res.rings }, (_, i) => (
                    <circle key={i} cx={cx} cy={cy} r={(R * (i + 1)) / res.rings} fill="none"
                      stroke={i + 1 === reach ? "#ffc23d" : "rgba(255,255,255,.45)"} strokeWidth={i + 1 === reach ? 2.5 : 1} />
                  ))}
                  <line ref={arrowRef} x1={cx} y1={cy} x2={cx} y2={cy - (R * reach) / res.rings} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
                  <circle cx={cx} cy={cy} r={6} fill="#fff" stroke="#000" strokeWidth={2} />
                </svg>
              );
            })()}

            {/*
              Solo si se abrió la URL directamente: el navegador no deja sonar sin un gesto.
              Pulsar aquí (o cualquier tecla) arranca sonido y timelapse a la vez.
            */}
            {sound.status === "blocked" && frameCount > 0 && (
              <button type="button" onClick={() => { sound.enable(); player.play(); }}
                className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-3 rounded-full bg-white px-6 py-4 text-base font-semibold text-black shadow-2xl transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400">
                <Play className="h-5 w-5 fill-current" aria-hidden /> Play with sound
              </button>
            )}

            {/* Cursor: círculo pequeño que sigue al ratón sobre el mapa (se mueve sin re-render). */}
            <div ref={cursorRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 transition-opacity duration-150 will-change-transform">
              <span ref={cursorDotRef} className="block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/25 shadow-[0_0_0_2px_rgba(0,0,0,0.45)]" />
            </div>

            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2 md:inset-x-6 md:top-6">
              <div className="glass-light flex min-w-0 items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest">
                <span className={`h-2 w-2 shrink-0 rounded-full bg-red-400 ${playing ? "animate-pulse" : ""}`} />
                <span className="hidden shrink-0 sm:inline">Earth Data Timelapse</span>
                {frame && (
                  <span className="truncate text-glass-muted normal-case tracking-normal">
                    <span className="hidden sm:inline">· </span>{frame.label} · {current + 1}/{frameCount}
                  </span>
                )}
              </div>
              <div className="pointer-events-auto flex shrink-0 items-center gap-2">
                <MapVoiceSwitch on={voice.mapVoice} onChange={voice.setMapVoice} />
                <Link href={`/playlists/${playlist.slug}`} className="md:hidden glass-light rounded-full p-2" aria-label="Back to playlist">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>
            </div>
            {/* En horizontal se oculta mientras la barra de controles lo tapa. */}
            <div data-controls={controlsOpen ? "open" : "closed"}
              className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-4 transition-opacity duration-300 md:bottom-6 md:left-6 md:right-6 land:data-[controls=open]:opacity-0">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-glass-muted">{playlist.title}</p>
                <p className="font-display text-3xl md:text-5xl">{track.title}</p>
              </div>
              {frame && meters.length > 0 && (
                <div className="hidden shrink-0 sm:flex items-end gap-4 text-[10px] uppercase tracking-widest text-glass-muted" aria-hidden>
                  {meters.map((m) => (
                    <div key={m.feature} className="flex w-16 flex-col items-center gap-1.5 text-center">
                      <div className="flex h-9 w-1.5 items-end overflow-hidden rounded-full bg-white/10">
                        <span className="w-full rounded-full bg-[var(--accent)] transition-all duration-700" style={{ height: `${8 + norm(m, frame.features[m.feature]) * 92}%` }} />
                      </div>
                      <span className="line-clamp-2 leading-tight">{m.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/*
          En horizontal: superpuesta al frame y pegada abajo. Al esconderla (deslizándola
          hacia abajo o con el chevron) baja animada y termina en `display: none`.
        */}
        <div ref={controlsRef} {...controlsSwipe} data-hidden={!controlsOpen}
          className="relative land:fixed land:inset-x-0 land:bottom-0 land:z-30 land:touch-none land:transition-[translate,display] land:transition-discrete land:duration-300 land:ease-[cubic-bezier(0.2,0.8,0.2,1)] land:starting:translate-y-full land:data-[hidden=true]:hidden land:data-[hidden=true]:translate-y-full">
        <button type="button" onClick={() => setControlsOpen(false)} aria-label="Hide controls"
          className="glass-strong absolute -top-6 left-1/2 hidden h-6 w-16 -translate-x-1/2 items-center justify-center rounded-b-none rounded-t-xl border-b-0 land:flex">
          <ChevronDown className="h-4 w-4" />
        </button>
        <footer data-voice-section="Playback controls" inert={land && !controlsOpen}
          className="glass-strong relative flex h-[10vh] min-h-20 items-center gap-4 rounded-3xl px-4 md:px-6 max-md:rounded-none max-md:border-x-0 max-md:border-b-0 land:h-auto land:min-h-0 land:gap-3 land:rounded-b-none land:border-x-0 land:border-b-0 land:py-1.5">
          <div className="flex w-1/4 min-w-0 items-center gap-3">
            {frame && <img src={frame.url} alt="" className="h-12 w-12 rounded-xl bg-black object-cover land:hidden" />}
            <div className="hidden sm:block min-w-0">
              <p className="truncate text-sm font-semibold">{track.title}</p>
              <p className="truncate text-xs text-glass-muted">{track.source ?? playlist.title}</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1.5 land:gap-1">
            <div className="flex items-center gap-5">
              {prevTrack && (
                <Link href={trackHref(prevTrack.slug)} aria-label={`Previous track: ${prevTrack.title}`} className="hidden sm:block text-glass-muted transition hover:text-glass">
                  <ListMusic className="h-4 w-4 -scale-x-100" />
                </Link>
              )}
              <button onClick={() => step(-1)} aria-label="Previous frame" className="text-glass-muted transition hover:scale-110 hover:text-glass"><SkipBack className="h-5 w-5 fill-current" /></button>
              {/* Reproducir sale del modo explorar: el radar y el timelapse no suenan a la vez. */}
              <button onClick={() => { if (explore && !playing) toggleExplore(); player.toggle(); }} disabled={frameCount === 0} aria-label={playing ? "Pause" : "Play"} className="grid h-12 w-12 land:h-10 land:w-10 place-items-center rounded-full bg-white text-black shadow-lg transition hover:scale-105 disabled:opacity-50">
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
              </button>
              <button onClick={() => step(1)} aria-label="Next frame" className="text-glass-muted transition hover:scale-110 hover:text-glass"><SkipForward className="h-5 w-5 fill-current" /></button>
              {nextTrack && (
                <Link href={trackHref(nextTrack.slug)} aria-label={`Next track: ${nextTrack.title}`} className="hidden sm:block text-glass-muted transition hover:text-glass">
                  <ListMusic className="h-4 w-4" />
                </Link>
              )}
            </div>
            <div className="flex w-full max-w-lg items-center gap-3 text-[11px] tabular-nums text-glass-muted">
              <span>{fmt(t)}</span>
              <input type="range" min={0} max={duration} step={0.1} value={Math.min(t, duration)} onChange={(e) => player.seek(+e.target.value)} aria-label="Seek" className="h-1 flex-1 cursor-pointer accent-white" />
              <span>{fmt(duration)}</span>
            </div>
          </div>
          <div className="flex w-1/4 items-center justify-end gap-2">
            <div className="relative">
              <button onClick={() => setSynthOpen(!synthOpen)} aria-label="Sound settings" aria-expanded={synthOpen} className="glass-light flex items-center gap-2 rounded-full px-3 py-2 text-xs">
                <AudioWaveform className="h-4 w-4" /> <span className="hidden lg:inline">{synth}</span>
              </button>
              {synthOpen && (
                <div data-voice-section="Sound settings menu" className="glass-strong jb-enter absolute bottom-14 right-0 w-52 rounded-2xl p-2">
                  <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-glass-muted">Sound</p>
                  {LAYER_MODES.map((m) => (
                    <button key={m} onClick={() => setLayers(m)} aria-pressed={m === layers}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/15 ${m === layers ? "bg-white/20" : ""}`}>{m}</button>
                  ))}
                  <p className="mt-1 px-3 py-2 text-[10px] uppercase tracking-widest text-glass-muted">Music synthesizer</p>
                  {PRESETS.map((s) => (
                    <button key={s} onClick={() => { setSynth(s); setSynthOpen(false); }} aria-pressed={s === synth}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/15 ${s === synth ? "bg-white/20" : ""}`}>{s}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMuted(!muted)} aria-pressed={muted} aria-label="Mute sound (S)"
                className="text-glass-muted transition hover:text-glass">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input type="range" min={0} max={100} value={vol} onChange={(e) => { setVol(+e.target.value); setMuted(false); }} aria-label="Volume" className="hidden h-1 w-20 accent-white lg:block" />
            </div>
            <button onClick={toggleExplore} aria-pressed={explore} aria-label="Explore the map with the radar (E)"
              className={`rounded-full p-2 ${explore ? "bg-amber-300 text-black" : "glass-light"}`}>
              <Disc3 className="h-4 w-4" />
            </button>
            <VoiceSettings variant="icon" className="glass-light rounded-full p-2" />
            <button onClick={() => setInfo(true)} aria-label="Track info" className="glass-light rounded-full p-2"><Info className="h-4 w-4" /></button>
          </div>
        </footer>
        </div>

        {/* Asa para volver a mostrar los controles: solo existe mientras están escondidos. */}
        {land && !controlsOpen && (
          <button type="button" aria-label="Show controls"
            onClick={() => setControlsOpen(true)}
            onPointerDown={(e) => { showStartY.current = e.clientY; }}
            onPointerUp={(e) => {
              if (showStartY.current !== null && e.clientY - showStartY.current < -20) setControlsOpen(true);
              showStartY.current = null;
            }}
            className="glass-strong jb-enter fixed bottom-0 left-1/2 z-30 flex h-7 w-16 -translate-x-1/2 touch-none items-center justify-center rounded-b-none rounded-t-xl border-b-0">
            <ChevronUp className="h-4 w-4" />
          </button>
        )}

        <div onClick={() => setInfo(false)} className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-500 ${info ? "opacity-100" : "pointer-events-none opacity-0"}`} />
        <aside aria-hidden={!info} inert={!info} data-voice-section="Track information panel" className={`glass-strong fixed bottom-4 right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-3xl p-7 transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${info ? "translate-x-0" : "translate-x-[110%]"}`}>
          <button onClick={() => setInfo(false)} aria-label="Close" className="glass-light absolute right-5 top-5 rounded-full p-2"><X className="h-4 w-4" /></button>
          <p className="text-xs uppercase tracking-widest text-glass-muted">Metadata & Science</p>
          <h3 className="mt-2 pr-10 font-display text-4xl leading-tight">{track.title}</h3>
          {frame && <img src={frame.url} alt="" className="mt-6 aspect-video w-full rounded-2xl bg-black object-contain" />}
          <div className="mt-6 space-y-6 text-sm leading-relaxed">
            <div>
              <p className="text-xs uppercase tracking-widest text-glass-muted">What you&apos;re seeing</p>
              {track.dataTitle && <p className="mt-2 font-semibold">{track.dataTitle}</p>}
              {track.description && <p className="mt-2">{track.description}</p>}
              {frame && <p className="mt-2 text-glass-muted">Now: {describe(current)}.</p>}
            </div>
            {(track.source || track.topic) && (
              <div className="glass-light rounded-2xl p-4">
                <p className="text-xs uppercase tracking-widest text-glass-muted">Source</p>
                {track.source && <p className="mt-1 flex items-center gap-2 font-semibold"><Satellite className="h-4 w-4 shrink-0" /> {track.source}</p>}
                {track.topic && <p className="mt-1 text-glass-muted">Topic: {track.topic}</p>}
              </div>
            )}
            {frame && meters.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-glass-muted">This frame{track.unit ? ` (${track.unit})` : ""}</p>
                <ul className="mt-3 space-y-2 tabular-nums">
                  {meters.map((m) => (
                    <li key={m.feature} className="flex justify-between gap-3">
                      <span className="text-glass-muted">{m.label}</span>
                      <span className="font-semibold">{frame.features[m.feature] != null ? fmtValue(frame.features[m.feature]!) : "—"}</span>
                    </li>
                  ))}
                  {frame.topRegion && (
                    <li className="flex justify-between gap-3">
                      <span className="text-glass-muted">Top region</span>
                      <span className="font-semibold">{frame.topRegion.name} · {fmtValue(frame.topRegion.value)}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-widest text-glass-muted">What you hear</p>
              <ul className="mt-3 space-y-2">
                <li><span className="font-semibold">Melody:</span> {track.listening.melody ?? "higher note = higher value"}.</li>
                {palette.hear ? (
                  <li><span className="font-semibold">Instruments:</span> {palette.hear}</li>
                ) : (
                  <li><span className="font-semibold">Nature:</span> earth rumble where the signal is over land, waves where it is over the ocean
                    {data.sound.texture === "rain" ? ", rain and wind" : data.sound.texture === "leaves" ? ", rustling leaves" : ", crackling"} growing with {track.listening.strong ?? "intensity"}.</li>
                )}
                {track.listening.secondary && <li><span className="font-semibold">Crystal bells:</span> {track.listening.secondary}.</li>}
                <li><span className="font-semibold">Left / right:</span> where on the map the signal is centered.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-glass-muted">Keyboard</p>
              <ul className="mt-3 space-y-1.5">
                {SHORTCUTS.map(([k, v]) => (
                  <li key={k} className="flex gap-3"><kbd className="w-14 shrink-0 font-semibold">{k}</kbd><span className="text-glass-muted">{v}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Switch "Map voice": decir el nombre del lugar al hacer clic en el mapa. */
function MapVoiceSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title="Say the name of the place when you click the map (M)"
      className="glass-light flex cursor-pointer items-center gap-2.5 rounded-full py-1.5 pl-3 pr-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
    >
      <span>Map voice</span>
      <span aria-hidden className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${on ? "bg-teal-400" : "bg-white/20"}`}>
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${on ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
