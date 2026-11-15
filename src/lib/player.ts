/**
 * Convierte la respuesta de la API en los datos (serializables y ligeros) que
 * recibe el reproductor en el cliente. Se ejecuta en el servidor: `grid` y
 * `regions` de cada frame no viajan al navegador.
 */
import { frameUrl } from "@/lib/api/frames";
import type { PlaylistDetail, TrackDetail } from "@/lib/api/types";

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
  };
  frames: PlayerFrame[];
  meters: PlayerMeter[];
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function frameLabel(date: string | undefined, index: number): string {
  if (date) {
    const d = new Date(`${date}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return MONTH.format(d);
  }
  return `Frame ${index + 1}`;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** `[a, b]` numérico o null. */
function pair(v: unknown): [number, number] | null {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n))
    ? [v[0] as number, v[1] as number]
    : null;
}

export function toPlayerData(playlist: PlaylistDetail, track: TrackDetail): PlayerData {
  const engine = track.engine_metadata ?? {};
  const hints = engine.hints ?? {};
  const words = hints.words ?? {};

  const frames: PlayerFrame[] = [...track.frames]
    .sort((a, b) => a.frame_index - b.frame_index)
    .map((f, i) => ({
      id: f.frame_id,
      url: frameUrl(track, f.frame_id),
      label: frameLabel(f.date, i),
      topRegion: f.top_region ? { name: f.top_region.name, value: f.top_region.value } : null,
      features: f.features ?? {},
      grid: Array.isArray(f.grid) ? f.grid : null,
    }));

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
      valueRange: pair(engine.value_range),
    },
    frames,
    meters,
  };
}
