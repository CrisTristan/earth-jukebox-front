/**
 * Tablas de color de NASA (formato GIBS: `<ColorMapEntry rgb value="[a,b)">`) en el
 * navegador, para la página How it works: color → valor y valor → color, como hace
 * el motor (en el motor la distancia es CIELAB; aquí basta RGB para la demostración).
 */
export type Rgb = readonly [number, number, number];

export interface ColorEntry {
  rgb: Rgb;
  lo: number;
  hi: number;
}

export interface ColorTable {
  title: string;
  units: string;
  entries: ColorEntry[];
}

/** Descarga y lee una tabla de color XML. */
export async function loadColorTable(url: string): Promise<ColorTable> {
  const text = await (await fetch(url)).text();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const map = doc.querySelector("ColorMap");
  const entries: ColorEntry[] = [];
  for (const el of doc.querySelectorAll("ColorMapEntry")) {
    if (el.getAttribute("transparent") === "true") continue;
    const rgb = (el.getAttribute("rgb") ?? "").split(",").map(Number);
    const range = (el.getAttribute("value") ?? "").match(/-?[\d.]+(?:e-?\d+)?/gi)?.map(Number) ?? [];
    if (rgb.length !== 3 || rgb.some(Number.isNaN) || range.length === 0) continue;
    entries.push({ rgb: [rgb[0]!, rgb[1]!, rgb[2]!], lo: range[0]!, hi: range[1] ?? range[0]! });
  }
  entries.sort((a, b) => a.lo - b.lo);
  return { title: map?.getAttribute("title") ?? "", units: map?.getAttribute("units") ?? "", entries };
}

export const entryValue = (e: ColorEntry) => (e.lo + e.hi) / 2;

/** Color de la tabla más cercano a (r, g, b), o null si ninguno está a menos de `max` (RGB). */
export function nearestEntry(t: ColorTable, r: number, g: number, b: number, max = 30): ColorEntry | null {
  let best: ColorEntry | null = null;
  let bestD = max * max;
  for (const e of t.entries) {
    const d = (e.rgb[0] - r) ** 2 + (e.rgb[1] - g) ** 2 + (e.rgb[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Color de un valor según la tabla. */
export function colorOfValue(t: ColorTable, v: number): Rgb {
  const list = t.entries;
  if (list.length === 0) return [255, 255, 255];
  let best = list[0]!;
  for (const e of list) {
    if (v >= e.lo && v < e.hi) return e.rgb;
    if (Math.abs(entryValue(e) - v) < Math.abs(entryValue(best) - v)) best = e;
  }
  return best.rgb;
}

/** Posición (0–1) de una entrada a lo largo de la tabla, para marcarla en la barra de color. */
export const entryPosition = (t: ColorTable, e: ColorEntry) => (t.entries.length > 1 ? t.entries.indexOf(e) / (t.entries.length - 1) : 0.5);
