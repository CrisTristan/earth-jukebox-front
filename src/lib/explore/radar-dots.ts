/**
 * Dibujo del radar sobre el mapa: bolitas repartidas en el círculo del radar. Cada
 * bolita toma el color real de la imagen en ese punto y crece con el valor del dato;
 * las que están bajo la flecha se encienden. Donde no hay dato quedan como polvo tenue.
 */
import type { Cell } from "@/lib/explore/disc";

const COUNT = 420;
/** Ángulo de oro: la espiral de Fermat reparte las bolitas parejas en todo el círculo. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Posición de cada bolita en el círculo unidad (ángulo de pantalla y radio 0–1). */
const LAYOUT = Array.from({ length: COUNT }, (_, i) => ({ ang: (i * GOLDEN) % (2 * Math.PI), r: Math.sqrt((i + 0.5) / COUNT) }));

export interface RadarDot {
  ang: number;
  /** Distancia al centro, 0–1 del radio del radar. */
  r: number;
  /** Color de la imagen en ese punto; null donde no hay dato. */
  color: string | null;
  /** Radio de la bolita (px). */
  size: number;
}

/** Píxeles de un frame, reducidos, para leer el color bajo cada bolita. */
export interface FramePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Lee los píxeles de la imagen del frame; null si el navegador no lo permite. */
export function readPixels(img: HTMLImageElement, maxWidth = 480): FramePixels | null {
  try {
    const k = Math.min(1, maxWidth / img.naturalWidth);
    const width = Math.max(1, Math.round(img.naturalWidth * k));
    const height = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return { width, height, data: ctx.getImageData(0, 0, width, height).data };
  } catch {
    return null;
  }
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Bolitas del radar con centro (`cx`, `cy`) y radio `R` en px del escenario.
 * `sample` dice qué hay en (u, v) de la imagen; `fallback` da el color de un nivel
 * cuando no se pueden leer los píxeles.
 */
export function buildDots(o: {
  cx: number;
  cy: number;
  R: number;
  map: Box;
  pixels: FramePixels | null;
  sample: (u: number, v: number) => Cell;
  fallback: (band: number) => string;
}): RadarDot[] {
  const dots: RadarDot[] = [];
  for (const { ang, r } of LAYOUT) {
    const x = o.cx + Math.cos(ang) * r * o.R;
    const y = o.cy + Math.sin(ang) * r * o.R;
    const u = (x - o.map.left) / o.map.width;
    const v = (y - o.map.top) / o.map.height;
    if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) continue;
    const cell = o.sample(u, v);
    if (cell.band == null) {
      dots.push({ ang, r, color: null, size: 0.9 });
      continue;
    }
    let color = o.fallback(cell.band);
    const px = o.pixels;
    if (px) {
      const i = (Math.min(px.height - 1, Math.floor(v * px.height)) * px.width + Math.min(px.width - 1, Math.floor(u * px.width))) * 4;
      // Un poco hacia el blanco, para que los colores oscuros del mapa se vean sobre el velo.
      const lift = (c: number) => Math.round(c + (255 - c) * 0.15);
      color = `rgb(${lift(px.data[i]!)},${lift(px.data[i + 1]!)},${lift(px.data[i + 2]!)})`;
    }
    const level = cell.value ?? 0.5;
    dots.push({ ang, r, color, size: 1.4 + 3.2 * Math.max(0, Math.min(1, level)) });
  }
  return dots;
}

const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

/** Dibuja el radar: velo oscuro, borde, bolitas (encendidas bajo la flecha), flecha y centro. */
export function drawRadar(
  ctx: CanvasRenderingContext2D,
  o: { cx: number; cy: number; R: number; arrow: number; reach: number; dots: RadarDot[]; t: number; still: boolean },
) {
  const { cx, cy, R } = o;
  ctx.fillStyle = "rgba(6,6,14,.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, 2 * Math.PI);
  ctx.stroke();

  for (const d of o.dots) {
    const x0 = cx + Math.cos(d.ang) * d.r * R;
    const y0 = cy + Math.sin(d.ang) * d.r * R;
    if (!d.color) {
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.beginPath();
      ctx.arc(x0, y0, d.size, 0, 2 * Math.PI);
      ctx.fill();
      continue;
    }
    const near = d.r <= o.reach ? Math.max(0, 1 - angleGap(o.arrow, d.ang) / 0.6) : 0;
    // Bajo la flecha vibran un poco de lado (salvo con movimiento reducido).
    const jitter = o.still ? 0 : near * 2.2 * Math.sin(o.t * 9 + d.r * 40);
    const x = x0 + Math.cos(d.ang + Math.PI / 2) * jitter;
    const y = y0 + Math.sin(d.ang + Math.PI / 2) * jitter;
    ctx.globalAlpha = 0.6 + 0.4 * near;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(x, y, d.size + near * 1.6, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const len = R * o.reach;
  const ex = cx + Math.cos(o.arrow) * len;
  const ey = cy + Math.sin(o.arrow) * len;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ex, ey, 3.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
}
