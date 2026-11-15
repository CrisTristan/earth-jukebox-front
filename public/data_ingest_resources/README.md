# Recursos

Frames de visualizaciones de la NASA que mide el motor de SpotiEarth (`app/cv_engine` en
earth-jukebox). Cada carpeta es un recurso: `data/` tiene los frames que se miden y, cuando
existe, `visual/` una versión para mostrar. `colormaps/` tiene las tablas de color.

Para medir una carpeta: `python scripts/ingest_timelapse.py --dir <carpeta>/data --profile <perfil> ...`

**Qué significa cada dataset, sus cifras y cómo escribir sobre él: [DATASETS.md](DATASETS.md).**
Es la guía para generar títulos y descripciones (también con IA) sin inventar datos.

## Mapas planos

| Carpeta | Qué es | Perfil | Origen |
|---|---|---|---|
| `precipitation` | Lluvia diaria (GPM IMERG) | `imerg-precipitation` | NASA GIBS |
| `sea-temperature` | Anomalía de temperatura del mar (GHRSST) | `sst-anomaly` | NASA GIBS |
| `vegetation` | Índice de vegetación (MODIS NDVI) | `ndvi-vegetation` | NASA GIBS |
| `air-temperature` | Temperatura del aire cerca de la superficie (GEOS-FP) | `geos-temperature` | [SVS 5147](https://svs.gsfc.nasa.gov/5147/) |
| `wind-speed` | Velocidad del viento (GEOS-FP) | `geos-wind` | [SVS 5148](https://svs.gsfc.nasa.gov/5148/) |
| `precipitation-clouds` | Lluvia y nubes (GEOS-FP) | `geos-precipitation` | [SVS 5149](https://svs.gsfc.nasa.gov/5149/) |
| `humidity` | Humedad cerca de la superficie (GEOS-FP) | `geos-humidity` | [SVS 5150](https://svs.gsfc.nasa.gov/5150/) |
| `air-quality-pm25` | Partículas finas PM2.5 (GEOS-CF) | `geos-pm25` | [SVS 5151](https://svs.gsfc.nasa.gov/5151/) |
| `air-quality-ozone` | Ozono cerca de la superficie (GEOS-CF) | `geos-o3` | [SVS 5152](https://svs.gsfc.nasa.gov/5152/) |
| `air-quality-carbon-monoxide` | Monóxido de carbono (GEOS-CF) | `geos-co` | [SVS 5153](https://svs.gsfc.nasa.gov/5153/) |
| `air-quality-nitrogen-oxides` | Óxidos de nitrógeno (GEOS-CF) | `geos-nox` | [SVS 5154](https://svs.gsfc.nasa.gov/5154/) |
| `surface-currents-temperature` | Corrientes coloreadas por temperatura del mar (ECCO2) | `ecco2-sst` | [SVS 3912](https://svs.gsfc.nasa.gov/3912/) |

## Globos (el planeta visto como esfera)

| Carpeta | Qué es | Perfil | Origen |
|---|---|---|---|
| `co2-globe` | Bruma de CO₂ de 2021, render volumétrico (índice relativo, no ppm) | `globe-co2` | [SVS 5115](https://svs.gsfc.nasa.gov/5115/) |
| `lightning-globe` | Rayos detectados desde la ISS 2017-2023 (índice relativo) | `globe-lightning` | [SVS 5011](https://svs.gsfc.nasa.gov/5011/) |
| `ocean-tour-temperature` | Perpetual Ocean 2: corrientes coloreadas por temperatura | `globe-ocean-temperature` | [SVS 5425](https://svs.gsfc.nasa.gov/5425/) |
| `ocean-tour-salinity` | Perpetual Ocean 2: corrientes coloreadas por salinidad | sin perfil | [SVS 5425](https://svs.gsfc.nasa.gov/5425/) |
| `ocean-tour-depth` | Perpetual Ocean 2, versión "beauty" (el color es profundidad) | sin perfil | [SVS 5425](https://svs.gsfc.nasa.gov/5425/) |

`ocean-tour-salinity` y `ocean-tour-depth` no tienen perfil: el centro gris de la barra de
salinidad se confunde con tierra y nubes, y en la versión "beauty" el blanco mezcla corrientes
de superficie con agua profunda cálida. Se guardan por si se quieren usar en el vídeo.

## Notas

- Los frames de `lightning-globe`, `humidity` y `ocean-tour-depth` salen de un vídeo: su
  `manifest.json` dice el segundo del vídeo de cada frame. Los de `ocean-tour-temperature` y
  `ocean-tour-salinity` llevan el segundo en el nombre (`frame_000_t0000.00s.png`).
- El enlace a la imagen o al segundo exacto del vídeo de cada frame está en
  `docs/frame_sources.md` de earth-jukebox.
- Las tablas de los recursos del SVS se reconstruyeron a partir de sus barras de color
  (`scripts/colorbar_to_xml.py`). Qué está confirmado y qué es supuesto está documentado en
  ese script.
