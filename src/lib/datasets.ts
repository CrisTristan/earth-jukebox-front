/**
 * Dataset del EIC que muestra la interfaz.
 *
 * Los frames se sirven desde `public/datasets/epic/` (WebP 1024 px). Cada frame
 * se identifica por su nombre (`frame_id`, p. ej. "frame_000.png") y aquí se
 * traduce a la imagen equivalente del frontend.
 */

export interface Dataset {
  id: string;
  title: string;
  tag: string;
  track: string;
  subtitle: string;
  instrument: string;
  science: string;
  /** Gradiente de fondo (3 colores). */
  gradient: readonly [string, string, string];
  framesPath: string;
  coverFrame: string;
  frameCount: number;
  /** Segundos que se muestra cada frame durante la reproducción. */
  secondsPerFrame: number;
}

export const EPIC_DATASET: Dataset = {
  id: "epic",
  title: "Earth from L1",
  tag: "Full Earth disk · EIC",
  track: "The Rotating Blue Marble",
  subtitle: "NASA EPIC · 13-frame timelapse",
  instrument: "DSCOVR · EPIC (Earth Polychromatic Imaging Camera)",
  science:
    "EPIC watches the entire sunlit face of the Earth from the L1 Lagrange point, about 1.5 million km away. Across this sequence the planet rotates: continents, oceans and cloud systems drift across the disk, and every change in what the camera sees changes the music.",
  gradient: ["oklch(0.18 0.05 250)", "oklch(0.42 0.11 230)", "oklch(0.55 0.09 200)"],
  framesPath: "/datasets/epic",
  coverFrame: "frame_006.png",
  frameCount: 13,
  secondsPerFrame: 4,
};

/** IDs de los frames del dataset: "frame_000.png", "frame_001.png"… */
export function frameIds(dataset: Dataset): string[] {
  return Array.from({ length: dataset.frameCount }, (_, i) => `frame_${String(i).padStart(3, "0")}.png`);
}

/** "frame_000.png" → "/datasets/epic/frame_000.webp" */
export function frameImageUrl(dataset: Dataset, frameId: string): string {
  return `${dataset.framesPath}/${frameId.replace(/\.(png|jpe?g)$/i, "")}.webp`;
}
