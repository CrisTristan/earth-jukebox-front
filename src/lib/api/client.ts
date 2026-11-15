/**
 * Acceso a la API de SpotiEarth desde Server Components.
 *
 * Las peticiones no se cachean: cada visita ve los datos actuales del backend.
 * Dentro de un mismo render, React deduplica los `fetch` GET idénticos, así que
 * pedir la misma track para la portada y para el reproductor cuesta una sola
 * petición.
 */
import { frameUrl } from "@/lib/api/frames";
import type { PlaylistDetail, PlaylistSummary, TrackDetail, TrackSummary } from "@/lib/api/types";

export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
  }
}

/** GET `/api/v1{route}`. Devuelve `null` en 404. */
async function getJson<T>(route: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${route}`, { headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new ApiError(`Could not reach the API at ${API_URL}`, undefined, { cause });
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw new ApiError("The API rate limit was exceeded. Try again in a minute.", 429);
  if (!res.ok) throw new ApiError(`The API responded ${res.status} for ${route}`, res.status);
  return (await res.json()) as T;
}

export async function getPlaylists(): Promise<PlaylistSummary[]> {
  return (await getJson<PlaylistSummary[]>("/playlists")) ?? [];
}

export function getPlaylist(slug: string): Promise<PlaylistDetail | null> {
  return getJson<PlaylistDetail>(`/playlists/${encodeURIComponent(slug)}`);
}

export function getTrack(slug: string): Promise<TrackDetail | null> {
  return getJson<TrackDetail>(`/tracks/${encodeURIComponent(slug)}`);
}

/** Imagen de portada de una track: su primer frame. */
export async function getTrackCover(track: TrackSummary): Promise<string | null> {
  const detail = await getTrack(track.slug);
  const first = detail?.frames[0];
  return detail && first ? frameUrl(detail, first.frame_id) : null;
}

/** Portada de una playlist: `cover_url` o, si no hay, la portada de su primera track. */
export async function getPlaylistCover(playlist: PlaylistSummary): Promise<string | null> {
  if (playlist.cover_url) return playlist.cover_url;
  const detail = await getPlaylist(playlist.slug);
  const first = detail?.tracks[0];
  return first ? getTrackCover(first) : null;
}
