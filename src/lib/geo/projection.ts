/**
 * Del puntero a coordenadas del mapa.
 *
 * Los frames son mapas equirectangulares que ocupan toda la imagen. La imagen
 * se dibuja con `object-contain` y un padding, así que primero se calcula el
 * rectángulo donde está el mapa de verdad.
 */

export interface GeoPoint {
  lon: number;
  lat: number;
  /** Posición relativa dentro del mapa (0–1, de izquierda a derecha y de arriba abajo). */
  u: number;
  v: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Rectángulo del contenido de una imagen con `object-contain` dentro de su caja (con padding). */
export function containedRect(box: Box, padding: number, naturalWidth: number, naturalHeight: number): Box {
  const w = Math.max(0, box.width - 2 * padding);
  const h = Math.max(0, box.height - 2 * padding);
  if (!naturalWidth || !naturalHeight || !w || !h) return { left: box.left + padding, top: box.top + padding, width: w, height: h };
  const scale = Math.min(w / naturalWidth, h / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    left: box.left + padding + (w - width) / 2,
    top: box.top + padding + (h - height) / 2,
    width,
    height,
  };
}

/** Punto de pantalla → lon/lat, o null si cae fuera del mapa. */
export function toGeo(
  x: number,
  y: number,
  map: Box,
  latRange: readonly [number, number],
  lonRange: readonly [number, number],
): GeoPoint | null {
  const u = (x - map.left) / map.width;
  const v = (y - map.top) / map.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  return {
    u,
    v,
    lon: lonRange[0] + u * (lonRange[1] - lonRange[0]),
    lat: latRange[0] + v * (latRange[1] - latRange[0]),
  };
}

/** Recuadro de la imagen que mide el motor `(left, top, right, bottom)`, en fracción 0–1. */
export type DataRegion = readonly [number, number, number, number];

export const FULL_IMAGE: DataRegion = [0, 0, 1, 1];

/**
 * Valor de la cuadrícula del motor en (u, v) de la imagen; null donde no hay dato
 * o fuera de `region` (la cuadrícula solo cubre ese recuadro).
 */
export function gridValue(grid: readonly (readonly (number | null)[])[] | null, u: number, v: number, region: DataRegion = FULL_IMAGE): number | null {
  if (!grid?.length) return null;
  const [left, top, right, bottom] = region;
  u = (u - left) / (right - left);
  v = (v - top) / (bottom - top);
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  const row = grid[Math.min(grid.length - 1, Math.floor(v * grid.length))];
  if (!row?.length) return null;
  const value = row[Math.min(row.length - 1, Math.floor(u * row.length))];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
