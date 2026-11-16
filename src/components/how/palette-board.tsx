"use client";

import { useEffect, useRef, useState } from "react";
import { Leaf, Music2, Volume2 } from "lucide-react";
import { PALETTES } from "@/lib/sound/palettes";
import { INSTRUMENT_NAMES, loadInstrument, playSample } from "@/lib/sound/samples";
import { noteFor } from "@/lib/sound/sonifier";

/** Nombre de cada dataset (perfil del motor) para la página. */
const DATASET_NAMES: Record<string, string> = {
  "geos-humidity": "Humidity",
  "geos-precipitation": "Rain and clouds",
  "imerg-precipitation": "Rain (IMERG)",
  "geos-temperature": "Air temperature",
  "ndvi-vegetation": "Vegetation",
  "geos-co": "Carbon monoxide",
  "geos-nox": "Nitrogen oxides",
  "geos-o3": "Ozone",
  "geos-pm25": "Fine particles",
  "geos-wind": "Wind",
  "sst-anomaly": "Sea temperature anomaly",
  "ecco2-sst": "Ocean currents",
  "globe-co2": "CO₂ globe",
  "globe-lightning": "Lightning globe",
  "globe-ocean-temperature": "Perpetual Ocean globe",
};

/** Frase corta de prueba: grados de la escala pentatónica del motor. */
const PHRASE = [3, 5, 7, 5, 8, 10];

/**
 * Paso 5: cada dataset tiene su banda. Los de naturaleza suenan a naturaleza; los
 * demás, a un instrumento con su propia textura. Cada tarjeta deja escucharlo.
 */
export function PaletteBoard() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => () => void ctxRef.current?.close().catch(() => {}), []);

  const preview = async (id: string) => {
    const palette = PALETTES[id]!;
    ctxRef.current ??= new AudioContext();
    const ctx = ctxRef.current;
    await ctx.resume();
    const inst = await loadInstrument(ctx, palette.melody);
    if (!inst) return;
    setPlayingId(id);
    const out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.05;
    PHRASE.forEach((d, k) => {
      playSample(inst, { t: t0 + k * 0.32, dest: out, midi: noteFor(d / 10) + palette.shift, gain: 0.35, pan: (k % 2 ? 0.25 : -0.25), dur: 1.4 });
    });
    window.setTimeout(() => setPlayingId((cur) => (cur === id ? null : cur)), PHRASE.length * 320 + 900);
  };

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(PALETTES).map(([id, p]) => {
        const natural = p.texture.kind === "nature";
        const active = playingId === id;
        return (
          <li key={id} className={`glass group relative overflow-hidden rounded-lg p-5 transition ${active ? "ring-2 ring-[var(--accent)]" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-glass-muted">
                  {natural ? <Leaf className="h-3.5 w-3.5" aria-hidden /> : <Music2 className="h-3.5 w-3.5" aria-hidden />}
                  {natural ? "Nature" : "Instrument"}
                </p>
                <p className="mt-1 font-display text-2xl leading-tight">{DATASET_NAMES[id] ?? id}</p>
              </div>
              <button type="button" onClick={() => void preview(id)} aria-label={`Listen to the ${INSTRUMENT_NAMES[p.melody]} of ${DATASET_NAMES[id] ?? id}`}
                className="glass-light grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:scale-110">
                <Volume2 className={`h-4 w-4 ${active ? "animate-pulse" : ""}`} />
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold capitalize">{INSTRUMENT_NAMES[p.melody]}</p>
            <p className="mt-1 text-sm leading-relaxed text-glass-muted">
              {p.hear ?? "Rumble, waves, wind and rain that grow with the data, with a harp melody and glockenspiel bells."}
            </p>
            {/* Ondas decorativas mientras suena */}
            <span aria-hidden className={`pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[var(--accent)] blur-3xl transition-opacity duration-700 ${active ? "opacity-30" : "opacity-0"}`} />
          </li>
        );
      })}
    </ul>
  );
}
