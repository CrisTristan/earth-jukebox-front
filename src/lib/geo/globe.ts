/**
 * Del puntero a latitud/longitud sobre un globo, con la cámara calibrada del frame
 * (ver `globe-cameras.ts`). Se lanza un rayo desde la cámara por el píxel y se
 * busca dónde toca la esfera.
 */
import { GLOBE_CAMERAS, GLOBE_VFOV } from "@/lib/geo/globe-cameras";

export type GlobeHit = { lon: number; lat: number } | "space";

/** Quita solo extensiones de imagen: hay claves con puntos, como `frame_000_t0000.00s`. */
const frameKey = (frameId: string) => frameId.replace(/\.(png|tiff?|webp|jpe?g)$/i, "");

/** ¿Hay cámaras calibradas para este track? */
export const hasGlobeCameras = (trackSlug: string) => trackSlug in GLOBE_CAMERAS;

/**
 * Punto del globo bajo (u, v), en fracción de la imagen (0–1, de izquierda a
 * derecha y de arriba abajo). `"space"` si el rayo no toca el planeta; null si
 * el frame no tiene cámara.
 */
export function globeAt(trackSlug: string, frameId: string, u: number, v: number, aspect: number): GlobeHit | null {
  const track = GLOBE_CAMERAS[trackSlug];
  const cam = track?.frames[frameKey(frameId)];
  if (!track || !cam) return null;
  const [cx, cy, cz, rx, ry, rz, ux, uy, uz, fx, fy, fz] = cam;
  const k = 2 * Math.tan((GLOBE_VFOV * Math.PI) / 360);
  const x = (u - track.pp[0]) * aspect * k;
  const y = (v - track.pp[1]) * k;
  let dx = fx + x * rx - y * ux;
  let dy = fy + x * ry - y * uy;
  let dz = fz + x * rz - y * uz;
  const len = Math.hypot(dx, dy, dz);
  dx /= len;
  dy /= len;
  dz /= len;
  // |C + t·d| = 1  →  t² + 2bt + c = 0
  const b = cx * dx + cy * dy + cz * dz;
  const c = cx * cx + cy * cy + cz * cz - 1;
  const disc = b * b - c;
  if (disc <= 0 || b >= 0) return "space";
  const t = -b - Math.sqrt(disc);
  const px = cx + t * dx;
  const py = cy + t * dy;
  const pz = cz + t * dz;
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, pz))) * 180) / Math.PI,
    lon: (Math.atan2(py, px) * 180) / Math.PI,
  };
}
