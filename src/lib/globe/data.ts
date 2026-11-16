/**
 * Convierte la respuesta de la API en los datos (serializables y ligeros) que
 * recibe el globo en el cliente. Se ejecuta en el servidor.
 */
import type { PlaylistDetail, TrackDetail } from "@/lib/api/types";
import type { DataRegion } from "@/lib/geo/projection";
import { pair, str, toPlayerData, type PlayerData } from "@/lib/player";
import { WORLD_BOUNDS, type GeoBounds } from "@/lib/globe/types";

export interface GlobeFrame {
  url: string;
  /** "Jan 2024" o "Frame 3". */
  label: string;
  /** Cuadrícula del motor (fila 0 = norte), para el radar; null si el frame no la trae. */
  grid: (number | null)[][] | null;
}

export interface GlobeData {
  playlist: { slug: string; title: string };
  track: {
    slug: string;
    title: string;
    description: string | null;
    source: string | null;
    /** Perfil del motor: decide los colores del tema. */
    profileId: string | null;
  };
  frames: GlobeFrame[];
  bounds: GeoBounds;
  /** Escala del dato para el radar (ver `PlayerData`). */
  dataScale: PlayerData["dataScale"];
  /** Niveles del dato que suena el radar; null si el dataset no tiene umbrales. */
  dataBands: PlayerData["dataBands"];
  /** Recuadro de la imagen que cubre la cuadrícula del motor. */
  dataRegion: DataRegion;
  /** Ruta de la misma track en el reproductor. */
  playerHref: string;
}

export function toGlobeData(playlist: PlaylistDetail, track: TrackDetail): GlobeData {
  const engine = track.engine_metadata ?? {};
  // Mismos frames (ordenados por `frame_index`), cuadrículas y niveles que el reproductor.
  const player = toPlayerData(playlist, track);
  return {
    playlist: { slug: playlist.slug, title: playlist.title },
    track: {
      slug: track.slug,
      title: track.title,
      description: track.description,
      source: str(track.source_metadata.source) ?? str(engine.source),
      profileId: str(track.source_metadata.profile_id),
    },
    frames: player.frames.map((f) => ({ url: f.url, label: f.label, grid: f.grid })),
    bounds: {
      latRange: pair(engine.lat_range) ?? WORLD_BOUNDS.latRange,
      lonRange: pair(engine.lon_range) ?? WORLD_BOUNDS.lonRange,
    },
    dataScale: player.dataScale,
    dataBands: player.dataBands,
    dataRegion: player.track.dataRegion,
    playerHref: `/playlists/${encodeURIComponent(playlist.slug)}/${encodeURIComponent(track.slug)}`,
  };
}
