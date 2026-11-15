/**
 * Recursos de la NASA que usa Earth Jukebox, para la página "NASA Data".
 *
 * Los textos de cada dataset salen de `public/data_ingest_resources/DATASETS.md`
 * (no se inventan cifras) y los enlaces, de la lista de recursos del equipo.
 */
import { FRAMES_ROOT } from "@/lib/api/frames";

/** Cómo se leen los valores de la visualización (ver DATASETS.md). */
export type ScaleKind = "official" | "approximate" | "relative";

export const SCALE_KINDS: Record<ScaleKind, { label: string; description: string }> = {
  official: {
    label: "Official scale",
    description: "Values come from the official NASA color scale, in physical units.",
  },
  approximate: {
    label: "Approximate reading",
    description: "The scale was rebuilt from the published color bar, so values are indicative.",
  },
  relative: {
    label: "Relative index",
    description: "No scale is published: a 0–1 index that means “more” or “less”, never a unit.",
  },
};

export interface Dataset {
  title: string;
  /** Qué muestra, en una frase. */
  summary: string;
  period: string;
  frames: number;
  scale: string;
  scaleKind: ScaleKind;
  source: { label: string; href: string };
  /** Primer frame, servido desde `public/data_ingest_resources`. */
  image: string;
  /** Reproductor de la track en el jukebox. */
  listen: string;
}

export interface DatasetGroup {
  id: string;
  title: string;
  provider: string;
  intro: string;
  datasets: Dataset[];
}

const frame = (folder: string, file: string) => `${FRAMES_ROOT}/${folder}/${file}`;
const svs = (id: number) => ({ label: `NASA SVS ${id}`, href: `https://svs.gsfc.nasa.gov/${id}/` });

const GEOS_PERIOD = "Oct 29 – Nov 13, 2026";

export const DATASET_GROUPS: DatasetGroup[] = [
  {
    id: "geos",
    title: "Weather & air quality forecasts",
    provider: "NASA Scientific Visualization Studio · GEOS model (GMAO)",
    intro:
      "Two weeks of the planet’s weather and air in autumn 2026. GEOS-FP blends millions of weather observations with a forecast model; GEOS-CF estimates what is in the air. These are model estimates, not satellite photos.",
    datasets: [
      {
        title: "Near-surface air temperature",
        summary: "Air temperature close to the ground, all over the world.",
        period: GEOS_PERIOD,
        frames: 32,
        scale: "−40 to 40 °C",
        scaleKind: "approximate",
        source: svs(5147),
        image: frame("air-temperature", "frame_000_00000001.webp"),
        listen: "/playlists/weather-timelapses/geos-temperature-2026-oct-nov",
      },
      {
        title: "Wind speed",
        summary: "Wind speed 10 meters above the surface; calm areas are not drawn.",
        period: GEOS_PERIOD,
        frames: 32,
        scale: "0 to 40 m/s",
        scaleKind: "approximate",
        source: svs(5148),
        image: frame("wind-speed", "frame_000_00000001.webp"),
        listen: "/playlists/weather-timelapses/geos-wind-2026-oct-nov",
      },
      {
        title: "Precipitation and clouds",
        summary: "Estimated rain, drawn over the clouds and the land.",
        period: GEOS_PERIOD,
        frames: 32,
        scale: "0 to 20 mm",
        scaleKind: "approximate",
        source: svs(5149),
        image: frame("precipitation-clouds", "frame_000_00000001.webp"),
        listen: "/playlists/water-timelapses/geos-precipitation-2026-oct-nov",
      },
      {
        title: "Near-surface humidity",
        summary: "Grams of water vapor in each kilogram of air near the surface.",
        period: "Oct 30 – Nov 14, 2026",
        frames: 32,
        scale: "0 to 22 g/kg",
        scaleKind: "approximate",
        source: svs(5150),
        image: frame("humidity", "frame_000.webp"),
        listen: "/playlists/water-timelapses/geos-humidity-2026-oct-nov",
      },
      {
        title: "Fine particles (PM2.5)",
        summary: "Dust, smoke and pollution small enough to breathe in.",
        period: GEOS_PERIOD,
        frames: 32,
        scale: "0.4 to 409.6 µg/m³ (log)",
        scaleKind: "approximate",
        source: svs(5151),
        image: frame("air-quality-pm25", "frame_000_00000001.webp"),
        listen: "/playlists/air-quality-timelapses/geos-pm25-2026-oct-nov",
      },
      {
        title: "Ground-level ozone (O₃)",
        summary: "Ozone near the surface, a pollutant — not the ozone layer.",
        period: GEOS_PERIOD,
        frames: 32,
        scale: "5 to 60 ppbv",
        scaleKind: "approximate",
        source: svs(5152),
        image: frame("air-quality-ozone", "frame_000_00000001.webp"),
        listen: "/playlists/air-quality-timelapses/geos-o3-2026-oct-nov",
      },
      {
        title: "Carbon monoxide (CO)",
        summary: "A gas that comes mostly from burning: fires, traffic and industry.",
        period: GEOS_PERIOD,
        frames: 32,
        scale: "40 to 500 ppbv",
        scaleKind: "approximate",
        source: svs(5153),
        image: frame("air-quality-carbon-monoxide", "frame_000_00000001.webp"),
        listen: "/playlists/air-quality-timelapses/geos-co-2026-oct-nov",
      },
      {
        title: "Nitrogen oxides (NOₓ)",
        summary: "NO and NO₂ near the surface, typical of traffic and industry.",
        period: GEOS_PERIOD,
        frames: 32,
        scale: "0.001 to ~20 ppbv (log)",
        scaleKind: "approximate",
        source: svs(5154),
        image: frame("air-quality-nitrogen-oxides", "frame_000_00000001.webp"),
        listen: "/playlists/air-quality-timelapses/geos-nox-2026-oct-nov",
      },
    ],
  },
  {
    id: "svs",
    title: "Oceans, carbon & lightning",
    provider: "NASA Scientific Visualization Studio",
    intro:
      "Ocean currents, a year of carbon dioxide and seven years of lightning. On the globes there are no countries to measure: “north” and “south” mean the top and bottom of the image.",
    datasets: [
      {
        title: "Sea surface currents and temperature",
        summary: "Ocean surface currents drawn as strokes, colored by water temperature (ECCO2 model).",
        period: "Dates not published",
        frames: 16,
        scale: "0 to 32 °C",
        scaleKind: "approximate",
        source: svs(3912),
        image: frame("surface-currents-temperature", "frame_000_flat_global_ecco2_2028x1024.23000.webp"),
        listen: "/playlists/oceans-timelapses/ecco2-sst-surface-currents",
      },
      {
        title: "Perpetual Ocean 2: temperature",
        summary: "A camera tour of the Kuroshio, Agulhas and Gulf Stream currents, colored by temperature.",
        period: "Camera tour",
        frames: 32,
        scale: "0 to 25 °C",
        scaleKind: "official",
        source: svs(5425),
        image: frame("ocean-tour-temperature", "frame_000_t0000.00s.webp"),
        listen: "/playlists/oceans-timelapses/globe-ocean-temperature-po2",
      },
      {
        title: "Atmospheric carbon dioxide (CO₂)",
        summary: "A volumetric haze of the CO₂ added to the atmosphere during 2021.",
        period: "2021",
        frames: 32,
        scale: "Relative index 0–1 (not ppm)",
        scaleKind: "relative",
        source: svs(5115),
        image: frame("co2-globe", "frame_000_TotalCO2_Comp_1920x1920p30_00000.webp"),
        listen: "/playlists/climate-timelapses/globe-co2-2021",
      },
      {
        title: "Lightning seen from the ISS",
        summary: "Lightning detected by the LIS sensor on the International Space Station.",
        period: "Jan 2017 – Jul 2023",
        frames: 32,
        scale: "Relative index 0–1",
        scaleKind: "relative",
        source: svs(5011),
        image: frame("lightning-globe", "frame_000.webp"),
        listen: "/playlists/weather-timelapses/globe-lightning-2017-2023",
      },
    ],
  },
  {
    id: "gibs",
    title: "Satellite maps",
    provider: "NASA GIBS · Earthdata",
    intro:
      "Global satellite products served by NASA’s Global Imagery Browse Services, each with an official color scale that tells us the real value of every pixel.",
    datasets: [
      {
        title: "Daily precipitation (IMERG)",
        summary: "Average daily rain rate around the world, from the GPM mission.",
        period: "2025, twice a month",
        frames: 24,
        scale: "mm/h",
        scaleKind: "official",
        source: { label: "GIBS · IMERG", href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GPM_Precipitation_Rate.xml" },
        image: frame("precipitation", "frame_2025-01-01.webp"),
        listen: "/playlists/water-timelapses/imerg-precipitation-2025",
      },
      {
        title: "Sea surface temperature anomaly",
        summary: "How much warmer or colder the sea is than normal (GHRSST MUR).",
        period: "Every Aug 15, 2003–2026",
        frames: 24,
        scale: "°C above or below normal",
        scaleKind: "official",
        source: {
          label: "GIBS · GHRSST",
          href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature_Anomalies.xml",
        },
        image: frame("sea-temperature", "frame_2003-08-15.webp"),
        listen: "/playlists/climate-timelapses/sst-anomaly-2003-2026",
      },
      {
        title: "Vegetation index (NDVI)",
        summary: "How much green, active vegetation covers the land (MODIS Terra).",
        period: "2024, monthly",
        frames: 12,
        scale: "NDVI 0 to 1",
        scaleKind: "official",
        source: { label: "GIBS · MODIS NDVI", href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml" },
        image: frame("vegetation", "frame_2024-01-01.webp"),
        listen: "/playlists/agriculture-timelapses/ndvi-vegetation-2024",
      },
    ],
  },
];

export interface ResourceLink {
  label: string;
  href: string;
}

/** Recursos que dio el reto (Earth Information Center). */
export const CHALLENGE_RESOURCES: ResourceLink[] = [
  { label: "Earth Information Center Content Database", href: "https://svs.gsfc.nasa.gov/gallery/earth-information-center/" },
  { label: "Data Sonification: Caldwell 73", href: "https://svs.gsfc.nasa.gov/13786/" },
  { label: "Change in Night Lights 2012–2023", href: "https://svs.gsfc.nasa.gov/5313/" },
  { label: "Global Sea Surface Currents and Temperature", href: "https://svs.gsfc.nasa.gov/3912/" },
  { label: "GEOS Aerosols", href: "https://svs.gsfc.nasa.gov/5669/" },
  { label: "Air Quality Model Runs", href: "https://svs.gsfc.nasa.gov/5533/" },
  { label: "Perpetual Ocean 2: Western Boundary Currents", href: "https://svs.gsfc.nasa.gov/5425/" },
  { label: "DYAMOND Global Carbon Dioxide", href: "https://svs.gsfc.nasa.gov/5196/" },
  { label: "Lightning Events Detected from the ISS 2017–2023", href: "https://svs.gsfc.nasa.gov/5011/" },
  { label: "A 3D View of an Atmospheric River", href: "https://svs.gsfc.nasa.gov/4960/" },
  { label: "GEDI Forest Height", href: "https://svs.gsfc.nasa.gov/4950/" },
];

const SVS_VIS = "https://svs.gsfc.nasa.gov/vis/a000000";

/** Material técnico: de dónde salen los frames y cómo se leen sus colores. */
export const TECHNICAL_RESOURCES: { title: string; description: string; links: ResourceLink[] }[] = [
  {
    title: "Official GIBS color tables",
    description: "The color scales that turn each satellite pixel into a real value.",
    links: [
      { label: "Color table directory (v1.3)", href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/" },
      { label: "Precipitation (IMERG)", href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GPM_Precipitation_Rate.xml" },
      { label: "Sea surface temperature anomaly", href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature_Anomalies.xml" },
      { label: "Vegetation (NDVI)", href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml" },
    ],
  },
  {
    title: "Frame folders downloaded from the SVS",
    description: "The original image sequences we measured.",
    links: [
      { label: "Temperature", href: `${SVS_VIS}/a005100/a005147/frames/2048x1024_2x1_12p/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en-hwtool/` },
      { label: "Wind", href: `${SVS_VIS}/a005100/a005148/frames/2048x1024_2x1_12p/MC02_stage3_GMAO_near_surface_wind_2048x1024_en-hwtool/` },
      { label: "Precipitation and clouds", href: `${SVS_VIS}/a005100/a005149/frames/2048x1024_2x1_12p/MC03_stage3_GMAO_precipitation_2048x1024_en-hwtool/` },
      { label: "PM2.5", href: `${SVS_VIS}/a005100/a005151/frames/2048x1024_2x1_12p/MC01_stage4_GMAO_pm25_2048x1024_en-hwtool/` },
      { label: "Ozone", href: `${SVS_VIS}/a005100/a005152/frames/2048x1024_2x1_12p/MC02_stage4_GMAO_O3_2048x1024_en-hwtool/` },
      { label: "Carbon monoxide", href: `${SVS_VIS}/a005100/a005153/frames/2048x1024_2x1_12p/MC03_stage4_GMAO_CO_2048x1024_en-hwtool/` },
      { label: "Nitrogen oxides", href: `${SVS_VIS}/a005100/a005154/frames/2048x1024_2x1_12p/MC04_stage4_GMAO_NO2_2048x1024_en-hwtool/` },
      { label: "ECCO2 currents", href: `${SVS_VIS}/a003900/a003912/frames/2048x1024_1x1_30p/orig/` },
      { label: "CO₂ globe", href: `${SVS_VIS}/a005100/a005115/frames/1920x1920_1x1_30p/VolumetricCO2_Composite/` },
    ],
  },
  {
    title: "Videos we extracted frames from",
    description: "Where no frame folder was available, we sampled frames from the video.",
    links: [
      { label: "Humidity", href: `${SVS_VIS}/a005100/a005150/MC04_stage3_GMAO_near_surface_humidity_2048x1024_en.mp4` },
      { label: "Lightning", href: `${SVS_VIS}/a005000/a005011/iss_lightning_sphere_07312023.mp4` },
      { label: "Perpetual Ocean, temperature", href: `${SVS_VIS}/a005400/a005425/perpetual_ocean2_CLOSE_096_temperature_1080p30.mp4` },
      { label: "Perpetual Ocean, salinity", href: `${SVS_VIS}/a005400/a005425/perpetual_ocean2_CLOSE_103_salinity_1080p30.mp4` },
      { label: "Perpetual Ocean, “beauty”", href: `${SVS_VIS}/a005400/a005425/perpetual_ocean2_beauty_hw5x3_810p30_5.mp4` },
    ],
  },
  {
    title: "Color bars used to rebuild the scales",
    description: "For SVS visualizations we reconstructed each scale from its published color bar.",
    links: [
      { label: "Temperature", href: `${SVS_VIS}/a005100/a005147/NearSurfaceTemperature_colorbar.png` },
      { label: "Wind", href: `${SVS_VIS}/a005100/a005148/NearSurfaceWindSpeed_colorbar.png` },
      { label: "Precipitation", href: `${SVS_VIS}/a005100/a005149/Precipitation_colorbar.png` },
      { label: "Humidity", href: `${SVS_VIS}/a005100/a005150/NearSurfaceHumidity_colorbar.png` },
      { label: "PM2.5", href: `${SVS_VIS}/a005100/a005151/PM2.5_colorbar.png` },
      { label: "Ozone", href: `${SVS_VIS}/a005100/a005152/O3_colorbar.png` },
      { label: "Carbon monoxide", href: `${SVS_VIS}/a005100/a005153/CO_colorbar.png` },
      { label: "Nitrogen oxides", href: `${SVS_VIS}/a005100/a005154/NOx_colorbar.png` },
      { label: "ECCO2", href: `${SVS_VIS}/a003900/a003912/sst_ecco2_cbar.png` },
      { label: "Perpetual Ocean, temperature", href: `${SVS_VIS}/a005400/a005425/perpetual_ocean2_CLOSE_101_cbar_temperature.png` },
      { label: "Perpetual Ocean, salinity", href: `${SVS_VIS}/a005400/a005425/perpetual_ocean2_CLOSE_100_salinity_cbar.png` },
      { label: "Perpetual Ocean, “beauty”", href: `${SVS_VIS}/a005400/a005425/perpetual_ocean2_CLOSE_101_cbar_beauty.png` },
      { label: "DYAMOND (comparison)", href: `${SVS_VIS}/a005100/a005196/dyamondCbar_6-27-2024a.png` },
    ],
  },
];
