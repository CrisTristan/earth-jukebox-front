"use client";

/* eslint-disable @next/next/no-img-element -- los frames se muestran tal cual, con object-contain y fundido */

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ArrowLeft, Info, Play, Pause, SkipBack, SkipForward, Volume2, X, AudioWaveform, ChevronRight, Satellite, ListMusic,
} from "lucide-react";
import { Announce } from "@/components/voice/announce";
import { useVoice } from "@/components/voice/voice-context";
import { VoiceSettings } from "@/components/voice/voice-settings";
import { usePlayback } from "@/hooks/use-playback";
import { loadCountries, placeAt, type CountryShape } from "@/lib/geo/places";
import { containedRect, toGeo } from "@/lib/geo/projection";
import { SECONDS_PER_FRAME, type PlayerData, type PlayerMeter } from "@/lib/player";
import { bgStyle } from "@/lib/theme";

/** Opciones del menú de sonido (solo interfaz, sin audio). */
const LAYER_MODES = ["Nature + music", "Nature only", "Music only"] as const;
const PRESETS = ["Ambient", "Pulsing", "Orchestral", "Granular"] as const;
type LayerMode = (typeof LAYER_MODES)[number];
type Preset = (typeof PRESETS)[number];

const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["← →", "Previous / next frame"],
  ["D", "Describe the current frame"],
  ["Click", "Hear the name of the place on the map"],
  ["V", "Voice guide on / off"],
  ["M", "Map voice on / off"],
  ["Esc", "Close panels"],
] as const;

/** Padding de la imagen en el escenario (`p-6`). */
const STAGE_PADDING = 24;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fmtValue = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
const norm = (m: PlayerMeter, v: number | undefined) =>
  v == null ? 0 : m.max - m.min < 1e-9 ? 0.5 : Math.max(0, Math.min(1, (v - m.min) / (m.max - m.min)));

export function TrackPlayer({ data }: { data: PlayerData }) {
  const { playlist, tracks, track, frames, meters } = data;
  const frameCount = frames.length;
  const duration = frameCount * SECONDS_PER_FRAME;

  const [info, setInfo] = useState(false);
  const [synthOpen, setSynthOpen] = useState(false);
  const [synth, setSynth] = useState<Preset>("Ambient");
  const [layers, setLayers] = useState<LayerMode>("Nature + music");
  const [vol, setVol] = useState(70);
  const [announcement, setAnnouncement] = useState("");

  const voice = useVoice();
  const stageRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLSpanElement>(null);
  const countriesRef = useRef<CountryShape[] | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);

  const player = usePlayback(duration, frameCount > 1);
  const playing = player.isPlaying;
  const t = player.position;

  const current = Math.max(0, Math.min(Math.floor(t / SECONDS_PER_FRAME), frameCount - 1));
  const frame = frames[current];
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

  // ---- Atajos de teclado ----
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select")) return;
    const onInteractive = !!target?.closest("button, a");
    const k = e.key;
    if (k === " " && !onInteractive) {
      e.preventDefault();
      player.toggle();
    } else if ((k === "m" || k === "M") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      voice.setMapVoice(!voice.mapVoice);
    } else if (k === "d" || k === "D") {
      setAnnouncement(describe(current));
    } else if (k === "Escape") {
      setInfo(false);
      setSynthOpen(false);
    } else if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      step(k === "ArrowLeft" ? -1 : 1);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  /** Punto de pantalla → lon/lat sobre el frame actual, o null si cae fuera del mapa. */
  const geoAt = (x: number, y: number) => {
    const img = stageRef.current?.querySelector("img");
    if (!img) return null;
    const map = containedRect(img.getBoundingClientRect(), STAGE_PADDING, img.naturalWidth, img.naturalHeight);
    return toGeo(x, y, map, track.latRange, track.lonRange);
  };

  /** El cursor se atenúa fuera del mapa. */
  const updateCursor = () => {
    rafRef.current = 0;
    const p = pointerRef.current;
    if (!p || !cursorRef.current) return;
    cursorRef.current.style.opacity = geoAt(p.x, p.y) ? "1" : "0.45";
  };

  const onStageMove = (e: React.PointerEvent<HTMLElement>) => {
    const stage = stageRef.current;
    if (e.pointerType === "mouse" && stage && cursorRef.current) {
      const rect = stage.getBoundingClientRect();
      cursorRef.current.style.transform = `translate3d(${e.clientX - rect.left}px, ${e.clientY - rect.top}px, 0)`;
    }
    pointerRef.current = { x: e.clientX, y: e.clientY };
    rafRef.current ||= requestAnimationFrame(updateCursor);
  };

  const onStageLeave = () => {
    if (cursorRef.current) cursorRef.current.style.opacity = "0";
    pointerRef.current = null;
  };

  const onStageClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    cursorDotRef.current?.animate([{ scale: "1" }, { scale: "1.9" }, { scale: "1" }], { duration: 280, easing: "ease-out" });
    const geo = geoAt(e.clientX, e.clientY);
    if (!geo) return;
    const countries = countriesRef.current;
    const text = countries ? placeAt(countries, geo.lon, geo.lat).spoken : "The map is still loading, try again in a moment.";
    setAnnouncement(text);
    voice.sayOnMap(text);
  };

  return (
    <div className="relative min-h-screen font-sans text-glass overflow-hidden">
      <div className="jb-bg" style={bgStyle} />
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <Announce
        text={`Now playing ${track.title}, from the playlist ${playlist.title}. Click the map to hear the name of the place. Use the Map voice switch, or press M, to turn that on or off.`}
      />

      <div className="jb-enter flex h-screen flex-col gap-4 p-4">
        <div className="flex min-h-0 flex-1 gap-4">
          <aside className="glass hidden md:flex w-1/4 max-w-xs flex-col rounded-3xl p-5">
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
            <div data-voice-section="Frames list" className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
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
            className="glass relative flex-1 cursor-none overflow-hidden rounded-3xl bg-black/60">
            {/* Timelapse: todos los frames apilados; el actual se muestra con fundido. */}
            {frames.map((f, i) => (
              <img key={f.id} src={f.url}
                alt={i === current ? `${track.imageLabel ?? track.title}, ${f.label} (frame ${i + 1} of ${frameCount})` : ""}
                aria-hidden={i !== current}
                className={`absolute inset-0 h-full w-full object-contain p-6 transition-opacity duration-1000 ${i === current ? "opacity-100" : "opacity-0"}`} />
            ))}
            {frameCount === 0 && (
              <p className="absolute inset-0 grid place-items-center text-glass-muted">This track has no frames.</p>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* Cursor: círculo pequeño que sigue al ratón sobre el mapa (se mueve sin re-render). */}
            <div ref={cursorRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 transition-opacity duration-150 will-change-transform">
              <span ref={cursorDotRef} className="block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/25 shadow-[0_0_0_2px_rgba(0,0,0,0.45)]" />
            </div>

            <div className="pointer-events-none absolute left-6 top-6 glass-light flex items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest">
              <span className={`h-2 w-2 rounded-full bg-red-400 ${playing ? "animate-pulse" : ""}`} /> Earth Data Timelapse
              {frame && <span className="text-glass-muted normal-case tracking-normal">· {frame.label} · {current + 1}/{frameCount}</span>}
            </div>
            <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
              <MapVoiceSwitch on={voice.mapVoice} onChange={voice.setMapVoice} />
              <Link href={`/playlists/${playlist.slug}`} className="md:hidden glass-light rounded-full p-2" aria-label="Back to playlist">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <div className="pointer-events-none absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-glass-muted">{playlist.title}</p>
                <p className="font-display text-4xl md:text-5xl">{track.title}</p>
              </div>
              {frame && meters.length > 0 && (
                <div className="hidden sm:flex items-end gap-3 text-[10px] uppercase tracking-widest text-glass-muted" aria-hidden>
                  {meters.map((m) => (
                    <div key={m.feature} className="flex w-14 flex-col items-center gap-1 text-center">
                      <div className="flex h-10 w-2 items-end overflow-hidden rounded-full bg-white/15">
                        <span className="w-full rounded-full bg-white/85 transition-all duration-700" style={{ height: `${8 + norm(m, frame.features[m.feature]) * 92}%` }} />
                      </div>
                      <span className="line-clamp-2 leading-tight">{m.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer data-voice-section="Playback controls" className="glass-strong relative flex h-[10vh] min-h-20 items-center gap-4 rounded-3xl px-4 md:px-6">
          <div className="flex w-1/4 min-w-0 items-center gap-3">
            {frame && <img src={frame.url} alt="" className="h-12 w-12 rounded-xl bg-black object-cover" />}
            <div className="hidden sm:block min-w-0">
              <p className="truncate text-sm font-semibold">{track.title}</p>
              <p className="truncate text-xs text-glass-muted">{track.source ?? playlist.title}</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex items-center gap-5">
              {prevTrack && (
                <Link href={trackHref(prevTrack.slug)} aria-label={`Previous track: ${prevTrack.title}`} className="hidden sm:block text-glass-muted transition hover:text-glass">
                  <ListMusic className="h-4 w-4 -scale-x-100" />
                </Link>
              )}
              <button onClick={() => step(-1)} aria-label="Previous frame" className="text-glass-muted transition hover:scale-110 hover:text-glass"><SkipBack className="h-5 w-5 fill-current" /></button>
              <button onClick={player.toggle} disabled={frameCount === 0} aria-label={playing ? "Pause" : "Play"} className="grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-lg transition hover:scale-105 disabled:opacity-50">
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
            <div className="hidden lg:flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-glass-muted" />
              <input type="range" min={0} max={100} value={vol} onChange={(e) => setVol(+e.target.value)} aria-label="Volume" className="h-1 w-20 accent-white" />
            </div>
            <VoiceSettings variant="icon" className="glass-light rounded-full p-2" />
            <button onClick={() => setInfo(true)} aria-label="Track info" className="glass-light rounded-full p-2"><Info className="h-4 w-4" /></button>
          </div>
        </footer>

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
