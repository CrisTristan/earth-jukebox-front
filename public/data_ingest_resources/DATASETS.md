# Guía de datasets de SpotiEarth

Este documento describe cada dataset de esta carpeta para que una persona o una IA pueda
escribir títulos, descripciones, guiones y textos de accesibilidad **sin inventar datos**.

SpotiEarth convierte timelapses de visualizaciones de la NASA en música. El motor
(`app/cv_engine` en el repo earth-jukebox) lee el color de cada píxel, lo traduce a un valor
con la escala de color de la visualización y resume cada frame en rasgos (cuánto hay, dónde,
cuántas manchas, cuánto cambió). Esos rasgos mueven la melodía, la textura y la intensidad.

## Reglas para quien escriba textos

1. **Usa solo los datos de este documento.** Si algo no está aquí (una causa, una cifra, un
   lugar), no lo afirmes o preséntalo como contexto general, no como medición.
2. **Distingue tres tipos de dato:**
   - **Medición física:** viene de una escala oficial (°C, mm/h, ppbv, µg/m³…).
   - **Lectura aproximada:** la escala se reconstruyó a partir de la imagen de la barra de
     color. Los valores son orientativos.
   - **Índice relativo (0-1):** la visualización no publica escala. Indica "más o menos",
     **no** una unidad. Nunca lo conviertas en ppm, rayos por segundo, etc.
3. **Los modelos no son observaciones.** GEOS-FP, GEOS-CF y ECCO2 son modelos: di "estimación
   del modelo" o "pronóstico", no "medido por satélite".
4. **Cita la fuente** como "NASA Scientific Visualization Studio (SVS)" o "NASA GIBS", con el
   número de página cuando lo haya.
5. **Escribe en español claro**, para público general y para personas con discapacidad
   visual: explica qué significa que la música suba o baje, sin depender de colores.
6. Las cifras de "Lo que mide el motor" salen de medir los frames de esta carpeta. Si se
   descargan otros frames, pueden cambiar.

## Estructura de cada carpeta

- `data/`: frames que se miden.
- `visual/` (solo en los tres primeros datasets): los mismos frames sobre un mapa de fondo,
  para mostrar en pantalla.
- `manifest.json` (en algunos): de qué vídeo y en qué segundo sale cada frame.
- `colormaps/`: tablas de color que usa el motor.

Glosario rápido de rasgos que pueden citarse:

| Rasgo | Significado |
|---|---|
| `mean` | Valor medio del mapa (o de la parte con dato) |
| `coverage` | Fracción del mapa donde hay fenómeno o dato |
| `p95` | Valor alto típico (lo supera solo el 5 % del área) |
| `frac_<umbral>` | Fracción del área que supera un umbral (p. ej. `frac_heavy`, lluvia fuerte) |
| `centroid_lat` | Latitud del "centro de gravedad" del fenómeno (positivo = norte) |
| `north_share` | Parte del fenómeno que está en el hemisferio norte |
| `shapes_count` | Número de manchas separadas (tormentas, olas de calor, focos) |
| `top_region` | Región con el valor medio más alto en ese frame |

---

# Mapas planos con escala oficial (NASA GIBS)

## Lluvia en el planeta durante 2025

- **Carpeta:** `precipitation` · **Perfil:** `imerg-precipitation`
- **Fuente:** NASA GIBS, capa `IMERG_Precipitation_Rate` (misión GPM, producto IMERG).
- **Qué muestra:** la tasa de precipitación promedio de cada día, en todo el mundo.
- **Periodo:** año 2025, dos frames por mes (días 1 y 15). 24 frames.
- **Formato:** mapa plano del mundo, 1440×720.
- **Escala:** milímetros por hora (mm/h), escala oficial. Verde, amarillo y rojo indican lluvia,
  de menos a más; los tonos azul claro son nieve. Sin color, no llueve.
- **Lo que mide el motor:**
  - Llueve en un 15-20 % del planeta en cada fecha.
  - Lluvia media global: 0.09-0.12 mm/h. Como es un promedio diario, 0.5 mm/h sostenidos son
    unos 12 mm en el día.
  - El centro de la lluvia se desplaza con las estaciones: unos 10° al sur del ecuador en
    marzo y unos 9° al norte en septiembre.
  - La región con más lluvia es casi siempre el Sudeste asiático.
- **Cómo suena:** la melodía sigue la latitud del centro de la lluvia (nota más aguda = más al
  norte); la intensidad sigue la lluvia fuerte; la nieve suena como capa aguda.
- **Ángulo narrativo:** el "cinturón de lluvias" del planeta respira con las estaciones,
  moviéndose al norte y al sur del ecuador a lo largo del año.
- **Ejemplo de título:** "La lluvia del planeta en 2025: un año que respira"

## Temperatura del mar: 24 veranos de calentamiento

- **Carpeta:** `sea-temperature` · **Perfil:** `sst-anomaly`
- **Fuente:** NASA GIBS, capa GHRSST L4 MUR25 de anomalías de temperatura de la superficie del mar.
- **Qué muestra:** cuánto más cálido o más frío está el mar respecto a lo normal.
- **Periodo:** un frame por año, cada 15 de agosto, de 2003 a 2026. 24 frames.
- **Formato:** mapa plano del mundo, 1440×720. La tierra no tiene dato.
- **Escala:** grados Celsius de diferencia con lo normal (anomalía), escala oficial. Azul = más
  frío de lo normal, rojo = más cálido.
- **Lo que mide el motor:**
  - Anomalía media del océano: alrededor de 0 °C entre 2003 y 2012, unos +0.3 °C entre 2016 y
    2022, +0.57 °C en 2023, +0.55 °C en 2024 y +0.64 °C en 2026 (el valor más alto de la serie).
  - Tendencia de toda la serie: unos +0.64 °C.
  - La región con mayor anomalía suele ser el Océano Ártico o el Atlántico Norte.
- **Cómo suena:** la melodía sigue la anomalía media: sube cuando el océano se calienta. Es la
  pista con la historia más clara de tendencia.
- **Ángulo narrativo:** el mismo día del año, 24 años seguidos; el mar de agosto es cada vez
  más cálido.
- **Ejemplo de título:** "24 agostos del océano: así suena el calentamiento"

## Vegetación: un año de verdor

- **Carpeta:** `vegetation` · **Perfil:** `ndvi-vegetation`
- **Fuente:** NASA GIBS, capa MODIS Terra NDVI mensual.
- **Qué muestra:** el índice de vegetación (NDVI): cuánta vegetación verde y activa hay en tierra.
- **Periodo:** 2024, un frame por mes (enero a diciembre). 12 frames.
- **Formato:** mapa plano del mundo, 1440×720. El mar no tiene dato.
- **Escala:** NDVI, de 0 a 1, sin unidad, escala oficial. Más verde = vegetación más densa.
- **Lo que mide el motor:**
  - NDVI medio de la tierra: 0.38 en enero, sube hasta 0.51 en julio-agosto y baja a 0.40 en
    diciembre.
  - El centro del verdor se mueve hacia el norte en el verano del hemisferio norte: de unos 7°
    a unos 26° de latitud norte.
  - La región más verde es casi siempre el Sudeste asiático.
- **Cómo suena:** la melodía sigue la latitud del verdor (sube hacia el norte en verano).
- **Ángulo narrativo:** el planeta reverdece y se apaga con las estaciones del hemisferio norte,
  donde está la mayor parte de la tierra.
- **Ejemplo de título:** "El pulso verde de la Tierra en 2024"

---

# Pronósticos GEOS (NASA SVS): mapas planos, unas dos semanas

Datos comunes de los ocho datasets de esta sección:

- **Qué son:** campos del modelo GEOS del GMAO de la NASA. GEOS-FP combina millones de
  observaciones del tiempo con un modelo de predicción para estimar el estado de la atmósfera;
  GEOS-CF estima la composición del aire (contaminantes). **Son estimaciones del modelo**, no
  fotos de satélite.
- **Periodo:** del 29 de octubre de 2026 (05:00 EDT) al 13 de noviembre de 2026 (15:00 EST),
  unas dos semanas. 32 frames, aproximadamente uno cada 12 horas. La humedad va del 30 de
  octubre al 14 de noviembre de 2026.
- **Formato:** mapa plano del mundo, 2048×1024, con el logo de NASA·GMAO arriba a la izquierda
  y la fecha y hora abajo a la izquierda (el motor los ignora).
- **Escala:** reconstruida a partir de la barra de color oficial de cada página → **lectura
  aproximada**.
- **Ángulo común:** el "tiempo del planeta" en dos semanas de otoño del hemisferio norte.

## Temperatura del aire

- **Carpeta:** `air-temperature` · **Perfil:** `geos-temperature` · **Fuente:** [SVS 5147](https://svs.gsfc.nasa.gov/5147/) (GEOS-FP, T2M)
- **Qué muestra:** la temperatura del aire cerca de la superficie.
- **Escala:** de -40 °C a 40 °C. Azules y morados = frío, el punto de congelación (0 °C) está en
  el centro, verdes y amarillos = templado, rojos, marrones y negro = muy caliente.
- **Lo que mide el motor:** temperatura media global de 15.1-15.7 °C; entre un 1 % y un 4 % del
  planeta supera los 30 °C en cada frame.
- **Cómo suena:** la melodía sigue la temperatura media; la intensidad, el área por encima de
  30 °C; el frío extremo (por debajo de -20 °C) es la capa secundaria.

## Velocidad del viento

- **Carpeta:** `wind-speed` · **Perfil:** `geos-wind` · **Fuente:** [SVS 5148](https://svs.gsfc.nasa.gov/5148/) (GEOS-FP, 10 m sobre la superficie)
- **Qué muestra:** la velocidad del viento a 10 metros de altura.
- **Escala:** de 0 a 40 m/s ("calma", "fuerte" en 20 m/s, "fuerza de huracán" en 40 m/s). Por
  debajo de unos 3.6 m/s no se dibuja (se ve el terreno).
- **Lo que mide el motor:** viento medio de 9-9.5 m/s donde se dibuja (alrededor de la mitad del
  mapa); entre un 2.5 % y un 3.5 % del área dibujada supera los 25 m/s (viento de tormenta);
  hasta 11 manchas de viento de tormenta a la vez.
- **Cómo suena:** la melodía sigue el viento medio; cada mancha de tormenta suma intensidad.
- **Cuidado:** no afirmes que en el resto del mapa "no hay viento"; simplemente no se dibuja.

## Lluvia y nubes

- **Carpeta:** `precipitation-clouds` · **Perfil:** `geos-precipitation` · **Fuente:** [SVS 5149](https://svs.gsfc.nasa.gov/5149/) (GEOS-FP)
- **Qué muestra:** la lluvia estimada, dibujada sobre las nubes y el terreno.
- **Escala:** de 0 a 20 mm, de verde (poca) a azul, morado, rojo, naranja y amarillo (muy
  fuerte). **La barra no indica el periodo** (¿por hora?): no lo afirmes.
- **Lo que mide el motor:** llueve en un 10-13 % del mapa; donde llueve, la media es de ~0.9 mm
  y los valores altos típicos de ~1.8 mm.
- **Cómo suena:** la melodía sigue la latitud del centro de la lluvia.

## Humedad del aire

- **Carpeta:** `humidity` · **Perfil:** `geos-humidity` · **Fuente:** [SVS 5150](https://svs.gsfc.nasa.gov/5150/) (GEOS-FP, Q2M)
- **Qué muestra:** la humedad específica cerca de la superficie: gramos de vapor de agua por
  kilogramo de aire.
- **Escala:** de 0 a 22 g/kg. Marrón = seco, beige = moderado, verde-azulado y azul = húmedo.
- **Lo que mide el motor:** humedad media de 10.5 g/kg; entre un 19 % y un 22 % del área supera
  los 18 g/kg (aire muy húmedo, sobre todo en los trópicos).
- **Frames:** extraídos de un vídeo de 31 s (uno por segundo, ver `manifest.json`).
- **Cómo suena:** la melodía sigue la latitud del centro de la humedad.

## Partículas finas (PM2.5)

- **Carpeta:** `air-quality-pm25` · **Perfil:** `geos-pm25` · **Fuente:** [SVS 5151](https://svs.gsfc.nasa.gov/5151/) (GEOS-CF)
- **Qué muestra:** la concentración de partículas finas (PM2.5) cerca de la superficie: polvo,
  humo y contaminación que se respiran.
- **Escala:** de 0.4 a 409.6 µg/m³, logarítmica. Crema = aire limpio, naranja, marrón oscuro =
  muy contaminado.
- **Lo que mide el motor:** media global de 1.7-2.3 µg/m³ (la mayor parte del planeta, sobre
  todo el océano, tiene aire limpio); entre un 0.4 % y un 0.9 % del mapa supera los 35 µg/m³,
  el límite diario de la EPA de EE. UU. Umbral de referencia: 15 µg/m³, guía diaria de la OMS.
- **Cómo suena:** la melodía sigue la concentración media; la intensidad, el aire insalubre.
- **Ángulo narrativo:** la contaminación está concentrada en pocos focos.

## Ozono a ras de suelo

- **Carpeta:** `air-quality-ozone` · **Perfil:** `geos-o3` · **Fuente:** [SVS 5152](https://svs.gsfc.nasa.gov/5152/) (GEOS-CF)
- **Qué muestra:** el ozono cerca de la superficie (contaminante, no la capa de ozono).
- **Escala:** de 5 a 60 ppbv (partes por mil millones). Blanco = poco, morado = mucho.
- **Lo que mide el motor:** media de 39-41 ppbv en la parte legible del mapa (algo menos de la
  mitad); entre un 7 % y un 12 % supera los 50 ppbv.
- **Cuidado:** no lo confundas con la capa de ozono estratosférica.

## Monóxido de carbono (CO)

- **Carpeta:** `air-quality-carbon-monoxide` · **Perfil:** `geos-co` · **Fuente:** [SVS 5153](https://svs.gsfc.nasa.gov/5153/) (GEOS-CF)
- **Qué muestra:** el monóxido de carbono cerca de la superficie, que viene sobre todo de la
  combustión (incendios, tráfico, industria).
- **Escala:** de 40 a 500 ppbv. Amarillo = poco, naranja, rojo, rojo oscuro = mucho.
- **Lo que mide el motor:** media de 76-82 ppbv; entre un 2 % y un 4 % del mapa supera los
  200 ppbv.
- **Cómo suena:** la melodía sigue la concentración media; las manchas altas, la intensidad.

## Óxidos de nitrógeno (NOₓ)

- **Carpeta:** `air-quality-nitrogen-oxides` · **Perfil:** `geos-nox` · **Fuente:** [SVS 5154](https://svs.gsfc.nasa.gov/5154/) (GEOS-CF)
- **Qué muestra:** los óxidos de nitrógeno (NO y NO₂) cerca de la superficie, típicos del tráfico
  y la industria.
- **Escala:** de 0.001 a unos 20 ppbv, logarítmica. Blanco = poco, verde, verde oscuro = mucho.
- **Lo que mide el motor:** media de 0.45-0.59 ppbv; entre un 10 % y un 12 % del mapa supera
  1 ppbv. La media la dominan pocos focos, por eso la melodía sigue el área contaminada.
- **Nota:** la carpeta de origen se llamaba "NO2", pero la visualización es de NOₓ.

---

# Corrientes del océano en mapa plano (NASA SVS)

## Corrientes y temperatura de la superficie del mar

- **Carpeta:** `surface-currents-temperature` · **Perfil:** `ecco2-sst` · **Fuente:** [SVS 3912](https://svs.gsfc.nasa.gov/3912/)
- **Qué muestra:** las corrientes de la superficie del océano como trazos, coloreados por la
  temperatura del agua. Modelo ECCO2 (MIT/JPL), que combina datos de satélite y del océano.
- **Periodo:** la página no indica las fechas. 16 frames.
- **Formato:** mapa plano del mundo, 2048×1024, fondo oscuro y tierra gris.
- **Escala:** de 0 a 32 °C. Azul = frío, verde, amarillo, rojo = cálido. Lectura aproximada.
- **Lo que mide el motor:** solo lee un ~7 % del mapa (los trazos brillantes); la temperatura
  media leída ronda los 22 °C, con el agua más cálida en el ecuador.
- **Cuidado:** la cifra media está sesgada hacia los trazos brillantes; no la presentes como la
  temperatura media del océano.

---

# Globos: el planeta visto como esfera (NASA SVS)

En estos datasets el motor mide la parte visible del planeta. No hay longitud geográfica ni
regiones: "norte" y "sur" significan "arriba" y "abajo" en la imagen.

## CO₂: la respiración del planeta en un año

- **Carpeta:** `co2-globe` · **Perfil:** `globe-co2` · **Fuente:** [SVS 5115](https://svs.gsfc.nasa.gov/5115/)
- **Qué muestra:** una visualización volumétrica del dióxido de carbono total añadido a la
  atmósfera durante 2021: una bruma naranja alrededor del globo, que gira.
- **Periodo:** año 2021; el vídeo incluye una línea de tiempo de enero a diciembre. 32 frames.
- **Formato:** globo de 1920×1920 con el título "Carbon Dioxide (CO₂)" arriba.
- **Escala:** **índice relativo 0-1** (densidad de la bruma). La página no publica barra de
  color. **No son ppm.**
- **Lo que mide el motor:**
  - La bruma sube de enero a mayo, baja durante el verano del hemisferio norte (cuando la
    vegetación absorbe CO₂) y vuelve a subir en otoño. Termina el año más densa que al empezar
    (índice 0.23 → 0.52).
  - Entre un 51 % y un 81 % de la bruma está en la mitad norte del globo.
- **Cómo suena:** la melodía sigue la densidad de la bruma.
- **Ángulo narrativo:** el planeta "respira" CO₂ con las estaciones, pero cada año acumula más.
- **Ejemplo de título:** "Un año de CO₂: la Tierra respira, pero no exhala todo"

## Rayos vistos desde la Estación Espacial

- **Carpeta:** `lightning-globe` · **Perfil:** `globe-lightning` · **Fuente:** [SVS 5011](https://svs.gsfc.nasa.gov/5011/)
- **Qué muestra:** los rayos detectados por el sensor LIS a bordo de la Estación Espacial
  Internacional (ISS), de enero de 2017 a julio de 2023, con una ventana móvil de 10 días. Datos
  científicos con control de calidad.
- **Formato:** destellos amarillos sobre un globo gris oscuro. Al principio la cámara se acerca
  mucho (frames 2-10, cerca de Indonesia y África) y en algunos frames se dibuja la trayectoria de
  la ISS; después el globo gira.
- **Frames:** 32, uno cada ~7 s de un vídeo de 216.7 s (ver `manifest.json`), recortados al globo.
- **Escala:** **índice relativo 0-1** (brillo de los destellos). No es un número de rayos.
- **Lo que mide el motor:** los destellos cubren entre 0 % y ~6 % del planeta visible; los
  máximos llegan cuando se ven América y África; sobre el Pacífico hay muy pocos. Se cuentan
  hasta ~46 grupos de tormentas a la vez.
- **Cómo suena:** la melodía sigue la cantidad de destellos a la vista; cada grupo de tormentas
  funciona como percusión.
- **Cuidado:** lo que suena depende también de lo que encuadra la cámara.

## Viaje por las corrientes del océano: temperatura

- **Carpeta:** `ocean-tour-temperature` · **Perfil:** `globe-ocean-temperature` · **Fuente:** [SVS 5425](https://svs.gsfc.nasa.gov/5425/) ("Perpetual Ocean 2: Western Boundary Currents", versión temperatura)
- **Qué muestra:** las corrientes del océano como trazos coloreados por la temperatura del agua.
  La cámara hace un recorrido: globo girando, corriente de Kuroshio (Japón), océano Índico y
  corriente de Agulhas (sur de África) y Corriente del Golfo (EE. UU.).
- **Frames:** 32, uno cada ~10 s del vídeo 1080p (el segundo está en el nombre de cada archivo).
- **Escala:** de 0 a 25 °C, escala oficial. Morado oscuro = frío, rosa, naranja, amarillo =
  cálido. El motor solo lee trazos de **4 °C o más** (los más fríos se confunden con el fondo).
- **Lo que mide el motor:** temperatura media de los trazos visibles de 9.6-17.6 °C; lo más
  cálido es la Corriente del Golfo (hasta un 56 % de los trazos supera los 20 °C); el globo
  entero y el Kuroshio rondan los 10-13 °C. Los trazos medidos son ~1-2 % del planeta visible.
- **Cómo suena:** la melodía sigue la temperatura del agua en movimiento.
- **Ángulo narrativo:** un viaje por las grandes corrientes que llevan calor de los trópicos
  hacia los polos.

## Viaje por las corrientes del océano: salinidad (sin perfil)

- **Carpeta:** `ocean-tour-salinity` · **Perfil:** ninguno · **Fuente:** [SVS 5425](https://svs.gsfc.nasa.gov/5425/), versión salinidad
- **Qué muestra:** el mismo recorrido, con las corrientes coloreadas por salinidad (33-36 PSU,
  verde azulado → gris → naranja → rojo).
- **Por qué no se mide:** el centro de la escala (34-35 PSU, lo más común) es gris y se confunde
  con tierra, hielo y nubes. Sirve como imagen para el vídeo, no como dato.

## Viaje por las corrientes del océano: versión "beauty" (sin perfil)

- **Carpeta:** `ocean-tour-depth` · **Perfil:** ninguno · **Fuente:** [SVS 5425](https://svs.gsfc.nasa.gov/5425/), versión "beauty"
- **Qué muestra:** el mismo recorrido, versión estética. Los flujos de la superficie hasta 600 m
  de profundidad van en blanco; los de más de 600 m, en azul-cian-blanco según su temperatura
  (-3 a 22 °C).
- **Frames:** 32, uno cada ~10 s de un vídeo para pared de pantallas (2400×810, 317.7 s).
- **Por qué no se mide:** un trazo blanco puede ser corriente de superficie o agua profunda
  cálida. Sirve como imagen, no como dato.
