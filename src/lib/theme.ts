import type { CSSProperties } from "react";

/**
 * Colores del fondo animado (`.jb-bg`): `[base, esfera superior, esfera inferior, acento]`.
 * Cada track usa los del colormap de su perfil del motor; cada playlist, los de su
 * track principal (el primero).
 */
type Palette = readonly [string, string, string, string];

export const DEFAULT_PALETTE: Palette = [
  "oklch(0.18 0.05 250)",
  "oklch(0.42 0.11 230)",
  "oklch(0.55 0.09 200)",
  "oklch(0.86 0.11 180)",
];

/** Paleta por perfil del motor (`source_metadata.profile_id`), tomada de su colormap. */
export const PROFILE_PALETTES: Record<string, Palette> = {
  // Monóxido de carbono: amarillo → naranja → rojo oscuro.
  "geos-co": ["oklch(0.17 0.04 30)", "oklch(0.55 0.17 45)", "oklch(0.40 0.14 25)", "oklch(0.84 0.11 60)"],
  // Óxidos de nitrógeno: blanco → verde → verde oscuro.
  "geos-nox": ["oklch(0.16 0.04 150)", "oklch(0.50 0.16 145)", "oklch(0.70 0.15 140)", "oklch(0.88 0.12 140)"],
  // Ozono: blanco → morado.
  "geos-o3": ["oklch(0.16 0.06 285)", "oklch(0.45 0.19 285)", "oklch(0.72 0.09 290)", "oklch(0.86 0.07 290)"],
  // PM2.5: crema → naranja → marrón.
  "geos-pm25": ["oklch(0.17 0.03 50)", "oklch(0.60 0.15 55)", "oklch(0.38 0.09 45)", "oklch(0.88 0.08 75)"],
  // Temperatura del aire: azul frío → rojo cálido.
  "geos-temperature": ["oklch(0.16 0.06 280)", "oklch(0.48 0.19 265)", "oklch(0.55 0.18 35)", "oklch(0.82 0.09 250)"],
  // Viento: azul → amarillo → rojo oscuro.
  "geos-wind": ["oklch(0.16 0.06 265)", "oklch(0.48 0.19 265)", "oklch(0.70 0.15 80)", "oklch(0.88 0.12 90)"],
  // Lluvia y nubes (GEOS): verde → morado → rojo.
  "geos-precipitation": ["oklch(0.16 0.05 290)", "oklch(0.45 0.19 300)", "oklch(0.58 0.16 150)", "oklch(0.85 0.12 150)"],
  // Humedad: marrón seco → azul húmedo.
  "geos-humidity": ["oklch(0.17 0.04 240)", "oklch(0.45 0.10 245)", "oklch(0.60 0.07 70)", "oklch(0.86 0.06 220)"],
  // Lluvia (IMERG): verde → amarillo → rojo.
  "imerg-precipitation": ["oklch(0.16 0.04 200)", "oklch(0.55 0.15 150)", "oklch(0.62 0.16 60)", "oklch(0.88 0.12 140)"],
  // Anomalía del mar: azul (más frío) y rojo (más cálido).
  "sst-anomaly": ["oklch(0.17 0.06 265)", "oklch(0.45 0.17 260)", "oklch(0.48 0.17 25)", "oklch(0.82 0.08 20)"],
  // Vegetación (NDVI): verde oliva y ocre.
  "ndvi-vegetation": ["oklch(0.18 0.04 140)", "oklch(0.48 0.12 130)", "oklch(0.58 0.11 85)", "oklch(0.90 0.12 125)"],
  // Corrientes ECCO2: azul → verde → rojo.
  "ecco2-sst": ["oklch(0.14 0.03 240)", "oklch(0.55 0.14 165)", "oklch(0.58 0.18 35)", "oklch(0.86 0.12 160)"],
  // Bruma de CO2: naranja y café sobre negro.
  "globe-co2": ["oklch(0.14 0.03 50)", "oklch(0.58 0.15 55)", "oklch(0.36 0.07 45)", "oklch(0.84 0.10 65)"],
  // Rayos: destellos amarillos sobre gris oscuro.
  "globe-lightning": ["oklch(0.14 0.02 260)", "oklch(0.35 0.04 260)", "oklch(0.72 0.15 95)", "oklch(0.90 0.13 95)"],
  // Perpetual Ocean (temperatura): índigo → morado → naranja.
  "globe-ocean-temperature": ["oklch(0.15 0.07 285)", "oklch(0.42 0.18 305)", "oklch(0.62 0.17 50)", "oklch(0.84 0.11 60)"],
};

/** Perfil del track principal (el primero) de cada playlist, para colorear la playlist. */
export const PLAYLIST_MAIN_PROFILE: Record<string, string> = {
  "air-quality-timelapses": "geos-co",
  "weather-timelapses": "geos-temperature",
  "water-timelapses": "geos-humidity",
  "climate-timelapses": "globe-co2",
  "oceans-timelapses": "globe-ocean-temperature",
  "agriculture-timelapses": "ndvi-vegetation",
};

const PROFILES_LONGEST_FIRST = Object.keys(PROFILE_PALETTES).sort((a, b) => b.length - a.length);

/**
 * Perfil de un track a partir de su slug, sin pedir datos a la API: los slugs
 * empiezan por el perfil (`geos-nox-2026-oct-nov` → `geos-nox`).
 */
export function profileFromTrackSlug(slug: string): string | null {
  return PROFILES_LONGEST_FIRST.find((p) => slug === p || slug.startsWith(`${p}-`)) ?? null;
}

export const playlistProfile = (slug: string): string | null => PLAYLIST_MAIN_PROFILE[slug] ?? null;

const paletteFor = (profile?: string | null): Palette => (profile && PROFILE_PALETTES[profile]) || DEFAULT_PALETTE;

/** Variables CSS del fondo (`--g1..--g3`) y del acento (`--accent`) para un perfil. */
export function themeStyle(profile?: string | null): CSSProperties {
  const [g1, g2, g3, accent] = paletteFor(profile);
  return { "--g1": g1, "--g2": g2, "--g3": g3, "--accent": accent } as CSSProperties;
}

/** Fondo por defecto (portada y secciones sin playlist). */
export const bgStyle = themeStyle();

/**
 * Reglas para que el fondo tome los colores de un elemento con `data-bg-theme`
 * bajo el puntero o con el foco del teclado (tarjetas de playlist, filas de track).
 */
export const HOVER_THEME_CSS = Object.entries(PROFILE_PALETTES)
  .map(([profile, [g1, g2, g3]]) =>
    `:root:has([data-bg-theme="${profile}"]:is(:hover,:focus-visible)) .jb-bg{--g1:${g1};--g2:${g2};--g3:${g3}}`)
  .join("\n");
