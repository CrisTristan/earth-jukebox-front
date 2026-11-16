/**
 * Cómo suena cada dataset (perfil del motor). Humedad, lluvia, temperatura y
 * vegetación suenan a naturaleza; el resto tiene una representación musical:
 * un instrumento para la melodía y una textura que crece con la intensidad del dato.
 *
 * La lógica no cambia (el dato decide nota, volumen, densidad y posición); la
 * paleta solo elige con qué sonido se toca.
 */
import type { InstrumentId } from "@/lib/sound/samples";

export type Texture =
  /** Camas y detalles de naturaleza (retumbo, olas, aire, lluvia, hojas…), sintetizados. */
  | { kind: "nature" }
  /**
   * Nota larga que se repite (`every` s); con `chord`, más voces cuanto más intenso.
   * Afinada (`shift` = semitonos sobre la nota de la melodía) o, sin `shift`, un golpe sin altura.
   */
  | { kind: "drone"; inst: InstrumentId; every: number; shift?: number; chord?: boolean }
  /** Pulso mecánico en una rejilla fija: más intensidad, más golpes. */
  | { kind: "pulse"; inst: InstrumentId }
  /** Granos sueltos (estática): más intensidad, más granos. */
  | { kind: "grains"; inst: InstrumentId }
  /** Dos notas casi iguales que "vibran" entre sí: más intensidad, más desafinadas. */
  | { kind: "shimmer"; inst: InstrumentId }
  /** Notas sueltas alrededor de la melodía, como un arpegio que fluye. */
  | { kind: "arpeggio"; inst: InstrumentId }
  /** Notas agudas pellizcadas, como destellos. */
  | { kind: "plucks"; inst: InstrumentId }
  /** Campanas de viento de vez en cuando. */
  | { kind: "chimes"; inst: InstrumentId }
  | { kind: "none" };

export interface Palette {
  /** Instrumento de la melodía. */
  melody: InstrumentId;
  /** Semitonos que se suman a la nota de la melodía (para caer en el registro del instrumento). */
  shift: number;
  /** Datos con centro (anomalías): instrumento cuando el valor está por encima del centro. */
  warm?: { inst: InstrumentId; shift: number };
  texture: Texture;
  /** Golpe del dato secundario (campana, timbal…). */
  accent: InstrumentId;
  /** Instrumento del radar y del clic en el mapa. */
  radar: InstrumentId;
  radarShift: number;
  /** Qué se oye, para el panel de información (null en los de naturaleza: ya se describe). */
  hear: string | null;
}

const NATURE: Palette = {
  melody: "harp",
  shift: 0,
  texture: { kind: "nature" },
  accent: "glock",
  radar: "harp",
  radarShift: 0,
  hear: null,
};

export const PALETTES: Record<string, Palette> = {
  // ---- Naturaleza: condensación (humedad y lluvia), temperatura y vegetación ----
  "geos-humidity": NATURE,
  "geos-precipitation": NATURE,
  "imerg-precipitation": NATURE,
  "geos-temperature": NATURE,
  "ndvi-vegetation": NATURE,

  // ---- Representación ----
  // Monóxido de carbono: dron oscuro de didgeridoo, como humo que se espesa.
  "geos-co": { melody: "saxello", shift: -12, texture: { kind: "drone", inst: "didgeridoo", every: 6 }, accent: "handbell", radar: "vibes", radarShift: -12, hear: "Saxello melody over a dark didgeridoo drone that thickens with dense smoke; hand bells mark elevated carbon monoxide." },
  // Óxidos de nitrógeno: pulso mecánico de tráfico e industria.
  "geos-nox": { melody: "xylo", shift: 0, texture: { kind: "pulse", inst: "woodblock" }, accent: "cabasa", radar: "xylo", radarShift: 0, hear: "Xylophone melody over a mechanical woodblock pulse that speeds up with pollution." },
  // Ozono: copas de cristal que vibran más cuanto más ozono.
  "geos-o3": { melody: "glass", shift: -6, texture: { kind: "shimmer", inst: "glass" }, accent: "glock", radar: "vibes", radarShift: -12, hear: "Wine-glass melody; two glasses beat against each other more as ozone rises." },
  // Partículas finas: granos de shaker, como estática; campana al pasar la guía de la OMS.
  "geos-pm25": { melody: "marimba", shift: 0, texture: { kind: "grains", inst: "shaker" }, accent: "handbell", radar: "marimba", radarShift: 0, hear: "Marimba melody over shaker grains, denser with more fine particles; a bell marks air above the WHO guideline." },
  // Viento: flauta dulce; salterio con arco cuando sopla fuerte.
  "geos-wind": { melody: "recorder", shift: -12, texture: { kind: "drone", inst: "psaltery-bow", every: 3, shift: 0 }, accent: "chimes", radar: "psaltery-pluck", radarShift: 0, hear: "Recorder melody; a bowed psaltery swells as the wind gets stronger, with wind chimes for strong wind." },
  // Anomalía del mar: frío = glockenspiel, calor = saxello.
  "sst-anomaly": { melody: "glock", shift: 0, warm: { inst: "saxello", shift: -12 }, texture: { kind: "none" }, accent: "handbell", radar: "vibes", radarShift: -12, hear: "Glockenspiel when the sea is cooler than normal, saxello when it is warmer." },
  // Corrientes (ECCO2): arpegios de arpa que fluyen.
  "ecco2-sst": { melody: "harp", shift: 0, texture: { kind: "arpeggio", inst: "harp" }, accent: "glock", radar: "harp", radarShift: 0, hear: "Harp melody with flowing harp arpeggios that grow with the warm water." },
  // CO₂: un órgano que respira con las estaciones.
  "globe-co2": { melody: "organ", shift: -12, texture: { kind: "drone", inst: "organ", every: 4, shift: -24, chord: true }, accent: "handbell", radar: "vibes", radarShift: -12, hear: "Organ melody over an organ chord that breathes with the seasons and gains voices as the haze thickens." },
  // Rayos: una cuerda pellizcada por destello; timbal en los destellos intensos.
  "globe-lightning": { melody: "psaltery-pluck", shift: 0, texture: { kind: "plucks", inst: "psaltery-pluck" }, accent: "timpani", radar: "psaltery-pluck", radarShift: 0, hear: "A plucked psaltery note for the flashes; timpani for bright flashes." },
  // Temperatura de las corrientes (Perpetual Ocean): marimba con campanas de viento.
  "globe-ocean-temperature": { melody: "marimba", shift: 0, texture: { kind: "chimes", inst: "chimes" }, accent: "glock", radar: "marimba", radarShift: 0, hear: "Marimba melody with wind chimes that grow with the warm currents." },
};

export const paletteFor = (profileId: string | null | undefined): Palette => (profileId && PALETTES[profileId]) || NATURE;

/** Instrumentos que usa una paleta (para cargarlos de una vez). */
export function paletteInstruments(p: Palette): InstrumentId[] {
  const ids = new Set<InstrumentId>([p.melody, p.accent, p.radar]);
  if (p.warm) ids.add(p.warm.inst);
  if ("inst" in p.texture) ids.add(p.texture.inst);
  return [...ids];
}
