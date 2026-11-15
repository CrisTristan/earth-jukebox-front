/**
 * Convierte la respuesta de la API en los datos (serializables y ligeros) que
 * recibe el globo en el cliente. Se ejecuta en el servidor.
 */
import { frameUrl } from "@/lib/api/frames";
import type { PlaylistDetail, TrackDetail } from "@/lib/api/types";
import { frameLabel, pair, str } from "@/lib/player";
import { WORLD_BOUNDS, type GeoBounds } from "@/lib/globe/types";

export interface GlobeFrame {
  url: string;
  /** "Jan 2024" o "Frame 3". */
  label: string;
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
  /** Ruta de la misma track en el reproductor. */
  playerHref: string;
}

export function toGlobeData(playlist: PlaylistDetail, track: TrackDetail): GlobeData {
  const engine = track.engine_metadata ?? {};
  return {
    playlist: { slug: playlist.slug, title: playlist.title },
    track: {
      slug: track.slug,
      title: track.title,
      description: track.description,
      source: str(track.source_metadata.source) ?? str(engine.source),
      profileId: str(track.source_metadata.profile_id),
    },
    frames: [...track.frames]
      .sort((a, b) => a.frame_index - b.frame_index)
      .map((f, i) => ({ url: frameUrl(track, f.frame_id), label: frameLabel(f.date, i) })),
    bounds: {
      latRange: pair(engine.lat_range) ?? WORLD_BOUNDS.latRange,
      lonRange: pair(engine.lon_range) ?? WORLD_BOUNDS.lonRange,
    },
    playerHref: `/playlists/${encodeURIComponent(playlist.slug)}/${encodeURIComponent(track.slug)}`,
  };
}
