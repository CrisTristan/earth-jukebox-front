import type { SourceMetadata } from "@/lib/api/types";

/**
 * Carpeta de `public/` con las imágenes: una subcarpeta por track, nombrada con
 * su `source_metadata.frames_directory`.
 */
export const FRAMES_ROOT = "/data_ingest_resources";

/** Extensión de las imágenes públicas (la API lista los frames como `.png`/`.tif`). */
const PUBLIC_EXTENSION = "webp";

type TrackRef = { slug: string; source_metadata: SourceMetadata };

const withExtension = (file: string, ext: string) => `${file.replace(/\.[^./]+$/, "")}.${ext}`;

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Carpeta pública de las imágenes de una track: `frames_base_url` si el backend
 * la conoce y, si no, `/data_ingest_resources/<frames_directory>`.
 */
export function framesBaseUrl(track: TrackRef): string {
  const meta = track.source_metadata;
  if (nonEmpty(meta.frames_base_url)) return meta.frames_base_url.replace(/\/+$/, "");
  const directory = nonEmpty(meta.frames_directory) ? meta.frames_directory : track.slug;
  return `${FRAMES_ROOT}/${encodeURIComponent(directory)}`;
}

/** `framesBaseUrl + "/" + frame_id`, con la extensión pública (`.webp`). */
export function frameUrl(track: TrackRef, frameId: string): string {
  const ext = track.source_metadata.frames_extension;
  const file = withExtension(frameId, nonEmpty(ext) ? ext : PUBLIC_EXTENSION);
  return `${framesBaseUrl(track)}/${encodeURIComponent(file)}`;
}

/**
 * Normaliza una ruta de imagen de la API (p. ej. `cover_url`): la hace absoluta
 * y, si apunta a `FRAMES_ROOT`, usa la extensión pública.
 */
export function publicImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const url = path.startsWith("/") ? path : `/${path}`;
  return url.startsWith(`${FRAMES_ROOT}/`) ? withExtension(url, PUBLIC_EXTENSION) : url;
}
