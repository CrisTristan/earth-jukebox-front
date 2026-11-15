import type { SourceMetadata } from "@/lib/api/types";

/** Carpeta de `public/` donde vive una subcarpeta por track (nombrada con su slug). */
export const FRAMES_ROOT = "/frames";

type TrackRef = { slug: string; source_metadata: SourceMetadata };

/**
 * Carpeta pública de las imágenes de una track: `frames_base_url` si el backend
 * la conoce y, si no, `/frames/<slug>`.
 */
export function framesBaseUrl(track: TrackRef): string {
  const base = track.source_metadata.frames_base_url;
  const url = typeof base === "string" && base.trim() ? base : `${FRAMES_ROOT}/${encodeURIComponent(track.slug)}`;
  return url.replace(/\/+$/, "");
}

/** `frames_base_url + "/" + frame_id` (con la extensión pública si es distinta). */
export function frameUrl(track: TrackRef, frameId: string): string {
  const ext = track.source_metadata.frames_extension;
  const file = typeof ext === "string" && ext ? `${frameId.replace(/\.[^./]+$/, "")}.${ext}` : frameId;
  return `${framesBaseUrl(track)}/${encodeURIComponent(file)}`;
}
