/**
 * Convierte la respuesta de la API en los datos (serializables y ligeros) que
 * recibe el reproductor en el cliente. Se ejecuta en el servidor: `grid` y
 * `regions` de cada frame no viajan al navegador.
 */
import { frameUrl } from "@/lib/api/frames";
import type { Frame, PlaylistDetail, TrackDetail } from "@/lib/api/types";
import { FULL_IMAGE, type DataRegion } from "@/lib/geo/projection";
import { globePath, isGlobeTrack } from "@/lib/globe/routes";
import type { ScaledFeature, SoundProfile } from "@/lib/sound/sonifier";

/** Segundos que se muestra cada frame durante la reproducción. */
export const SECONDS_PER_FRAME = 4;

export interface PlayerFrame {
  /** `frame_id` de la API (nombre del archivo). */
  id: string;
  /** `/data_ingest_resources/<frames_directory>/<frame_id>.webp` (ver `frameUrl`). */
  url: string;
  /** "Jan 2024" si el frame trae fecha; si no, "Frame 3". */
  label: string;
  topRegion: { name: string; value: number } | null;
  features: Record<string, number>;
  /** Cuadrícula del motor (fila 0 = norte); null si el frame no la trae. */
  grid: (number | null)[][] | null;
  /** Parte del dato sobre tierra (0–1) según las regiones del motor; null si no hay regiones. */
  land: number | null;
}

export interface PlayerMeter {
  feature: string;
  label: string;
  min: number;
  max: number;
}

export interface PlayerData {
  playlist: { slug: string; title: string };
  tracks: { slug: string; title: string }[];
  track: {
    slug: string;
    title: string;
    description: string | null;
    /** Perfil del motor (`source_metadata.profile_id`): decide los colores del fondo. */
    profileId: string | null;
    source: string | null;
    topic: string | null;
    unit: string | null;
    dataTitle: string | null;
    imageLabel: string | null;
    /** Latitudes del borde superior e inferior del mapa. */
    latRange: [number, number];
    /** Longitudes del borde izquierdo y derecho del mapa. */
    lonRange: [number, number];
    /** Rango de valores de la cuadrícula, para normalizar el sonido. */
    valueRange: [number, number] | null;
    /** Recuadro de la imagen que cubre la cuadrícula del motor (ver `dataRegion`). */
    dataRegion: DataRegion;
    /** Qué se oye, en palabras del motor (`hints.words`). */
    listening: { melody: string | null; strong: string | null; secondary: string | null; subject: string | null };
  };
  frames: PlayerFrame[];
  meters: PlayerMeter[];
  /** Cómo se convierte cada frame en sonido (ver `Sonifier`). */
  sound: SoundProfile;
  /**
   * Escala del dato para el disco de exploración, con todas las cuadrículas de la
   * track: `low`/`top` (percentiles 5 y 95) normalizan el valor y `high`
   * (percentil 80) marca dónde el dato es "alto". null si no hay cuadrículas.
   */
  dataScale: { low: number; high: number; top: number } | null;
  /** Niveles del dato según los umbrales del dataset (el disco clasifica con ellos). */
  dataBands: DataBands | null;
  /** Ruta del globo interior para esta track, o null si sus frames no son un mapa 2:1. */
  globeHref: string | null;
}

/** Un nivel del dato para el disco de exploración (p. ej. "humo denso, ≥ 200 ppbv"). */
export interface DataBand {
  name: string;
  /** Rango en unidades del dato, para leerlo: "130–200 ppbv". */
  range: string;
  color: string;
  /** Voz del disco (0 = la más calmada … 3 = la más intensa). */
  voice: number;
}

export interface DataBands {
  /** Cortes ascendentes: el nivel `i` va de `cuts[i-1]` a `cuts[i]`. */
  cuts: number[];
  bands: DataBand[];
  /** Sin dato = cero (lluvia, rayos): cuenta como el nivel más bajo, no como silencio. */
  missingIsZero: boolean;
}

/** Umbrales que marcan lo que queda por debajo (frío, mar más frío de lo normal). */
const BELOW_KEY = /^(frigid|cold|cool|freezing)$/i;

/** Colores de los niveles, de menos a más, según qué significa "más" en el dataset. */
const BAND_PALETTES = {
  alarming: ["#5b6fa8", "#e8c547", "#f08a2c", "#e5383b"],
  good: ["#8d6e45", "#c9b458", "#7cc46a", "#2f9e44"],
  neutral: ["#4f7bd9", "#5bc0be", "#f0c04a", "#ff7a3d"],
  diverging: ["#7ab8ff", "#9aa3b5", "#f0a04a", "#e5383b"],
} as const;

const humanize = (key: string) => key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const fmtCut = (v: number) => (Math.abs(v) >= 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100));

/**
 * Niveles del dato a partir de los umbrales del motor (`engine_metadata.thresholds`),
 * nombrados con las palabras del dataset (`hints.words`). Sin umbrales, null.
 */
function dataBands(track: TrackDetail): DataBands | null {
  const engine = track.engine_metadata ?? {};
  const hints = engine.hints ?? {};
  const words = hints.words ?? {};
  const thresholds = engine.thresholds;
  if (!thresholds || typeof thresholds !== "object") return null;
  const entries = Object.entries(thresholds as Record<string, unknown>)
    .filter((e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]))
    .sort((a, b) => a[1] - b[1]);
  if (entries.length === 0) return null;

  const unit = typeof engine.unit === "string" && engine.unit ? ` ${engine.unit}` : "";
  const subject = typeof words.subject === "string" ? words.subject : null;
  const missingIsZero = engine.missing_is_zero === true;
  // Cada umbral se nombra con la palabra del dataset que lo usa (intensidad o secundario).
  const label = (key: string) =>
    hints.intensity === `frac_${key}` && words.strong ? words.strong
      : hints.secondary === `frac_${key}` && words.secondary ? words.secondary
        : humanize(key);

  const cuts = entries.map(([, v]) => v);
  const n = cuts.length; // n umbrales → n + 1 niveles
  const diverging = entries.some(([k]) => BELOW_KEY.test(k));
  const palette = BAND_PALETTES[diverging ? "diverging" : hints.more_is === "alarming" ? "alarming" : hints.more_is === "good" ? "good" : "neutral"];

  const bands: DataBand[] = [];
  for (let i = 0; i <= n; i++) {
    let name: string;
    if (i === 0) {
      const [key0] = entries[0]!;
      name = BELOW_KEY.test(key0) ? label(key0) : missingIsZero ? "Little or none" : `Low${subject ? ` · ${subject}` : ""}`;
    } else {
      const [key] = entries[i - 1]!;
      name = BELOW_KEY.test(key) ? "Normal" : label(key);
    }
    const range = i === 0 ? `< ${fmtCut(cuts[0]!)}${unit}` : i === n ? `≥ ${fmtCut(cuts[n - 1]!)}${unit}` : `${fmtCut(cuts[i - 1]!)}–${fmtCut(cuts[i]!)}${unit}`;
    const voice = n === 0 ? 3 : Math.round((i * 3) / n);
    bands.push({ name, range, color: palette[voice]!, voice });
  }
  return { cuts, bands, missingIsZero };
}

/** Percentiles 5, 80 y 95 de todos los valores de las cuadrículas. */
function dataScale(frames: PlayerFrame[]): PlayerData["dataScale"] {
  const values: number[] = [];
  for (const f of frames) for (const row of f.grid ?? []) for (const v of row) if (typeof v === "number" && Number.isFinite(v)) values.push(v);
  if (values.length < 10) return null;
  values.sort((a, b) => a - b);
  const at = (p: number) => values[Math.min(values.length - 1, Math.floor(p * values.length))]!;
  const low = at(0.05);
  const top = at(0.95);
  return top > low ? { low, high: at(0.8), top } : null;
}

/** Regiones del motor que son océano; el resto se considera tierra. */
const WATER_REGION = /pacific|atlantic|indian|arctic|southern|ocean|sea|gulf/i;

/**
 * Cuánto del dato está sobre tierra: media de cada región (normalizada con el
 * rango de valores) por su cobertura, sumada aparte para tierra y océano.
 */
function landShare(frame: Frame, valueRange: [number, number] | null): number | null {
  const regions = frame.regions;
  if (!regions || typeof regions !== "object") return null;
  let land = 0;
  let total = 0;
  for (const [id, region] of Object.entries(regions as Record<string, Record<string, unknown> | null>)) {
    const mean = region?.mean;
    if (typeof mean !== "number" || !Number.isFinite(mean)) continue;
    const coverage = typeof region?.coverage === "number" ? region.coverage : 1;
    const level = valueRange && valueRange[1] !== valueRange[0]
      ? Math.max(0, Math.min(1, (mean - valueRange[0]) / (valueRange[1] - valueRange[0])))
      : 0.5;
    const weight = coverage * (0.1 + level);
    total += weight;
    if (!WATER_REGION.test(id)) land += weight;
  }
  return total > 0 ? land / total : null;
}

/**
 * `data_region` de los perfiles que recortan la imagen antes de medirla, para las
 * tracks ingestadas antes de que el motor lo publicara en `engine_metadata`.
 */
const KNOWN_DATA_REGIONS: Record<string, DataRegion> = {
  "globe-co2": [0.078, 0.058, 0.921, 0.901],
};

/** Recuadro que cubre la cuadrícula: el que publica el motor, el conocido del perfil o la imagen entera. */
function dataRegion(engine: TrackDetail["engine_metadata"], profileId: string | null): DataRegion {
  const r = engine.data_region;
  if (Array.isArray(r) && r.length === 4 && r.every((n) => typeof n === "number" && Number.isFinite(n)) && r[2] > r[0] && r[3] > r[1]) {
    return [r[0], r[1], r[2], r[3]];
  }
  return (profileId && KNOWN_DATA_REGIONS[profileId]) || FULL_IMAGE;
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Jan 2024" si hay fecha válida; si no, "Frame 3". */
export function frameLabel(date: string | undefined, index: number): string {
  if (date) {
    const d = new Date(`${date}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return MONTH.format(d);
  }
  return `Frame ${index + 1}`;
}

export const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** `[a, b]` numérico o null. */
export function pair(v: unknown): [number, number] | null {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n))
    ? [v[0] as number, v[1] as number]
    : null;
}

export function toPlayerData(playlist: PlaylistDetail, track: TrackDetail): PlayerData {
  const engine = track.engine_metadata ?? {};
  const hints = engine.hints ?? {};
  const words = hints.words ?? {};

  const valueRange = pair(engine.value_range);

  const frames: PlayerFrame[] = [...track.frames]
    .sort((a, b) => a.frame_index - b.frame_index)
    .map((f, i) => ({
      id: f.frame_id,
      url: frameUrl(track, f.frame_id),
      label: frameLabel(f.date, i),
      topRegion: f.top_region ? { name: f.top_region.name, value: f.top_region.value } : null,
      features: f.features ?? {},
      grid: Array.isArray(f.grid) ? f.grid : null,
      land: landShare(f, valueRange),
    }));

  /**
   * Feature con su rango: el que da la API (p. ej. `hints.melody.range`), si no
   * `feature_stats` y si no el mínimo y máximo de los frames. null si ningún frame la trae.
   */
  const scaled = (feature: unknown, range?: unknown): ScaledFeature | null => {
    if (typeof feature !== "string" || !feature) return null;
    const values = frames.map((f) => f.features[feature]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length === 0) return null;
    const given = pair(range);
    const stats = engine.feature_stats?.[feature];
    return {
      feature,
      min: given?.[0] ?? stats?.min ?? Math.min(...values),
      max: given?.[1] ?? stats?.max ?? Math.max(...values),
    };
  };
  const melodyHint = (hints.melody ?? {}) as { feature?: unknown; range?: unknown };

  // Indicadores definidos por el perfil del motor (`hints`), con su nombre legible.
  const candidates: [string | undefined, string | undefined][] = [
    [hints.intensity, words.strong],
    [hints.secondary, words.secondary],
    [hints.level, words.subject],
  ];
  const seen = new Set<string>();
  const meters: PlayerMeter[] = [];
  for (const [feature, label] of candidates) {
    if (!feature || seen.has(feature) || frames.every((f) => f.features[feature] == null)) continue;
    seen.add(feature);
    const values = frames.map((f) => f.features[feature]).filter((v): v is number => typeof v === "number");
    const stats = engine.feature_stats?.[feature];
    meters.push({
      feature,
      label: label ?? feature,
      min: stats?.min ?? Math.min(...values),
      max: stats?.max ?? Math.max(...values),
    });
  }

  return {
    playlist: { slug: playlist.slug, title: playlist.title },
    tracks: [...playlist.tracks]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((t) => ({ slug: t.slug, title: t.title })),
    track: {
      slug: track.slug,
      title: track.title,
      description: track.description,
      profileId: str(track.source_metadata.profile_id),
      source: str(track.source_metadata.source) ?? str(engine.source),
      topic: str(track.source_metadata.topic) ?? str(engine.topic),
      unit: str(engine.unit),
      dataTitle: str(engine.title),
      imageLabel: str(words.image),
      // Valores por defecto del motor: mapa del mundo completo.
      latRange: pair(engine.lat_range) ?? [90, -90],
      lonRange: pair(engine.lon_range) ?? [-180, 180],
      valueRange,
      dataRegion: dataRegion(engine, str(track.source_metadata.profile_id)),
      listening: { melody: str(words.melody), strong: str(words.strong), secondary: str(words.secondary), subject: str(words.subject) },
    },
    frames,
    meters,
    sound: {
      profileId: str(track.source_metadata.profile_id),
      melody: scaled(melodyHint.feature, melodyHint.range) ?? scaled(hints.level),
      intensity: scaled(hints.intensity),
      secondary: scaled(hints.secondary),
      brightness: scaled(hints.brightness),
      texture: str(hints.texture),
      valueRange,
    },
    dataScale: dataScale(frames),
    dataBands: dataBands(track),
    globeHref: isGlobeTrack(track) ? globePath(playlist.slug, track.slug) : null,
  };
}
