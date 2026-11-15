/**
 * ¿Qué hay en esta latitud/longitud? País y continente, o el mar u océano.
 *
 * Las fronteras salen de `world-atlas` (Natural Earth 1:110m, unos 100 KB) y se
 * cargan bajo demanda, solo en el reproductor. `geoContains` trabaja sobre la
 * esfera, así que acierta también con países que cruzan el antimeridiano.
 */
import { geoBounds, geoContains } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { CONTINENT_OF, SPOKEN_NAME } from "@/lib/geo/continents";

export interface Place {
  /** Identificador estable, para detectar cuándo se cruza una frontera. */
  key: string;
  /** Frase para decir en voz alta: "Brazil, South America". */
  spoken: string;
  kind: "country" | "water";
}

export interface CountryShape {
  name: string;
  feature: Feature<Geometry>;
  /** [[oeste, sur], [este, norte]]; si oeste > este, cruza el antimeridiano. */
  bounds: [[number, number], [number, number]];
}

let shapes: Promise<CountryShape[]> | null = null;

/** Carga (una vez) las fronteras de los países. */
export function loadCountries(): Promise<CountryShape[]> {
  shapes ??= Promise.all([import("world-atlas/countries-110m.json"), import("topojson-client")]).then(
    ([atlas, topojson]) => {
      const topology = (atlas.default ?? atlas) as unknown as Parameters<typeof topojson.feature>[0];
      const collection = topojson.feature(topology, (topology.objects as Record<string, never>).countries) as unknown as {
        features: Feature<Geometry, { name: string }>[];
      };
      return collection.features.map((feature) => ({
        name: feature.properties.name,
        feature,
        bounds: geoBounds(feature) as CountryShape["bounds"],
      }));
    },
  );
  return shapes;
}

function inBounds([[w, s], [e, n]]: CountryShape["bounds"], lon: number, lat: number) {
  if (lat < s || lat > n) return false;
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
}

/** Continente de un país; Rusia y Francia dependen de dónde caiga el punto. */
function continentOf(name: string, lon: number): string | undefined {
  if (name === "Russia") return lon >= 60 || lon < -160 ? "Asia" : "Europe";
  return CONTINENT_OF.get(name);
}

function countryPlace(name: string, lon: number): Place {
  // En el mapa 1:110m, la Guayana Francesa forma parte del polígono de Francia.
  if (name === "France" && lon < -30) return { key: "French Guiana", spoken: "French Guiana, South America", kind: "country" };
  if (name === "Antarctica") return { key: name, spoken: "Antarctica", kind: "country" };
  const spoken = SPOKEN_NAME[name] ?? name;
  const continent = continentOf(name, lon);
  const label = spoken.replace(/^the /, "");
  return {
    key: name === "Russia" ? `Russia-${continent}` : name,
    spoken: continent ? `${label[0]!.toUpperCase()}${label.slice(1)}, ${continent}` : label,
    kind: "country",
  };
}

/** Mares y océanos con cajas aproximadas: basta para orientarse. */
function waterAt(lon: number, lat: number): string {
  const box = (w: number, e: number, s: number, n: number) => lon >= w && lon <= e && lat >= s && lat <= n;
  if (lat > 66) return "the Arctic Ocean";
  if (lat < -60) return "the Southern Ocean";
  if (box(-6, 36, 30, 46)) return "the Mediterranean Sea";
  if (box(27, 42, 40.5, 47.5)) return "the Black Sea";
  if (box(46, 55, 36, 47.5)) return "the Caspian Sea";
  if (box(32, 44, 12, 30)) return "the Red Sea";
  if (box(47.5, 57, 23.5, 30.5)) return "the Persian Gulf";
  if (box(9, 30, 53, 66)) return "the Baltic Sea";
  if (box(-4, 9, 51, 61)) return "the North Sea";
  if (box(-95, -76, 51, 66)) return "Hudson Bay";
  if (box(-98, -80, 18, 31)) return "the Gulf of Mexico";
  if (box(-84, -60, 9, 22)) return "the Caribbean Sea";
  if (lon >= 20 && lon < 147 && lat < 30 && !(lon >= 100 && lat > 0) && !(lon >= 120 && lat > -10)) return "the Indian Ocean";
  if (lon >= -70 && lon < 20) return "the Atlantic Ocean";
  if (lon >= -100 && lon < -70 && lat > 8) return "the Atlantic Ocean";
  return "the Pacific Ocean";
}

/** Lugar en (lon, lat), con las fronteras ya cargadas. */
export function placeAt(countries: readonly CountryShape[], lon: number, lat: number): Place {
  for (const c of countries) {
    if (inBounds(c.bounds, lon, lat) && geoContains(c.feature, [lon, lat])) return countryPlace(c.name, lon);
  }
  const water = waterAt(lon, lat);
  const spoken = water.replace(/^the /, "");
  return { key: water, spoken: `${spoken[0]!.toUpperCase()}${spoken.slice(1)}`, kind: "water" };
}
