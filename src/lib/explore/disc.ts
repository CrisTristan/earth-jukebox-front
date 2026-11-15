/**
 * Disco de exploración (adaptado de "Capas de la Tierra", `index.html`).
 *
 * Alrededor de un origen elegido en el mapa se trazan anillos (capas) cortados en
 * pasos, como un disco. Cada celda se clasifica solo por el dato del dataset: en
 * qué nivel cae su valor según los umbrales del motor (p. ej. CO: bajo, "monóxido
 * elevado" ≥ 130 ppbv, "humo denso" ≥ 200 ppbv). Una flecha recorre el disco y
 * suena lo que encuentra.
 */
import type { DataBand } from "@/lib/player";

/** Lo que hay en un punto: nivel del dato (índice en `bands`, null = sin dato) y valor normalizado (0–1). */
export interface Cell {
  band: number | null;
  value: number | null;
}

export interface DiscGrid {
  rings: number;
  steps: number;
  /** `cells[anillo][paso]`; el anillo 0 es el del centro. */
  cells: Cell[][];
  /** Nivel predominante en cada paso (todos los anillos). */
  dominant: (number | null)[];
}

/** Origen en fracción de la imagen (0–1) y radio en fracción del lado corto. */
export interface Origin {
  u: number;
  v: number;
  radius: number;
}

export const RESOLUTIONS = [
  { label: "Low", rings: 3, steps: 16 },
  { label: "Medium", rings: 6, steps: 48 },
  { label: "High", rings: 9, steps: 72 },
] as const;

/** Ángulo del paso `j` (0 = arriba, sentido horario, en radianes de pantalla). */
export const stepAngle = (j: number, steps: number) => (2 * Math.PI * j) / steps - Math.PI / 2;

/** Nivel predominante de una lista de celdas (null si todas están sin dato). */
function majority(cells: Cell[]): number | null {
  const c = new Map<number | null, number>();
  for (const cell of cells) c.set(cell.band, (c.get(cell.band) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = -1;
  for (const [band, count] of c) {
    if (count > bestCount) [best, bestCount] = [band, count];
  }
  return best;
}

/**
 * Recorre los anillos alrededor del origen y clasifica cada celda con 2×2 muestras.
 * `aspect` = ancho / alto de la imagen, para que los anillos sean círculos en pantalla.
 */
export function analyze(sample: (u: number, v: number) => Cell, origin: Origin, aspect: number, rings: number, steps: number): DiscGrid {
  const short = Math.min(aspect, 1);
  const ru = (origin.radius * short) / aspect;
  const rv = origin.radius * short;
  const cells: Cell[][] = [];
  for (let i = 0; i < rings; i++) {
    const row: Cell[] = [];
    for (let j = 0; j < steps; j++) {
      const samples: Cell[] = [];
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          const ang = stepAngle(j + (b + 0.5) / 2, steps);
          const q = (i + (a + 0.5) / 2) / rings;
          samples.push(sample(origin.u + ru * q * Math.cos(ang), origin.v + rv * q * Math.sin(ang)));
        }
      }
      const values = samples.map((s) => s.value).filter((v): v is number => v != null);
      row.push({ band: majority(samples), value: values.length ? values.reduce((x, y) => x + y, 0) / values.length : null });
    }
    cells.push(row);
  }
  const dominant = Array.from({ length: steps }, (_, j) => majority(cells.map((row) => row[j]!).filter((c) => c.band != null)));
  return { rings, steps, cells, dominant };
}

/** Porcentaje de celdas en cada nivel (y sin dato, en `none`). */
export function composition(grid: DiscGrid, bands: number): { byBand: number[]; none: number } {
  const byBand = new Array<number>(bands).fill(0);
  let none = 0;
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.band == null) none++;
      else byBand[cell.band]!++;
    }
  }
  const total = grid.rings * grid.steps;
  return { byBand: byBand.map((n) => Math.round((n / total) * 100)), none: Math.round((none / total) * 100) };
}

const COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

/** Dirección del paso `j` (arriba = norte en los mapas planos). */
export const direction = (j: number, steps: number) => COMPASS[Math.round((j / steps) * 8) % 8]!;

/** "Step 3 of 48, northeast: humo denso, monóxido elevado. Data level 62 percent." — con los anillos al alcance de la flecha. */
export function stepText(grid: DiscGrid, j: number, reach: number, bands: DataBand[]): string {
  const c = new Map<number, number>();
  let sum = 0;
  let n = 0;
  for (let i = 0; i < reach; i++) {
    const cell = grid.cells[i]?.[j];
    if (!cell) continue;
    if (cell.band != null) c.set(cell.band, (c.get(cell.band) ?? 0) + 1);
    if (cell.value != null) {
      sum += cell.value;
      n++;
    }
  }
  // De más a menos celdas; con empate, primero el nivel más alto.
  const found = [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([band]) => bands[band]!.name);
  const data = n ? ` Data level ${Math.round((sum / n) * 100)} percent.` : "";
  return `Step ${j + 1} of ${grid.steps}, ${direction(j, grid.steps)}: ${found.length ? found.join(", ") : "no data"}.${data}`;
}

/** "Origin in humo denso (≥ 200 ppbv). Around, Low dominates, 58 percent." */
export function originText(grid: DiscGrid, origin: Cell, bands: DataBand[]): string {
  const { byBand } = composition(grid, bands.length);
  const best = byBand.reduce((bi, v, i) => (v > byBand[bi]! ? i : bi), 0);
  const here = origin.band == null ? "no data" : `${bands[origin.band]!.name} (${bands[origin.band]!.range})`;
  return `Origin in ${here}. Around, ${bands[best]!.name} dominates, ${byBand[best]} percent.`;
}
