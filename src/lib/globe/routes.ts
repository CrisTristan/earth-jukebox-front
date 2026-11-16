import type { TrackDetail } from "@/lib/api/types";

/** Ruta base del globo interior. */
export const GLOBE_ROOT = "/globo";

/**
 * Los frames de la track son un mapa equirectangular (2:1) y se pueden envolver
 * en la esfera. Las tracks con `projection: "globe"` ya son una esfera vista
 * desde fuera (o un acercamiento) y no sirven.
 */
export function isGlobeTrack(track: Pick<TrackDetail, "engine_metadata">): boolean {
  return track.engine_metadata?.projection === "equirectangular";
}

/** `/globo/<playlist>/<track>`. */
export function globePath(playlistSlug: string, trackSlug: string): string {
  return `${GLOBE_ROOT}/${encodeURIComponent(playlistSlug)}/${encodeURIComponent(trackSlug)}`;
}
