# earth-jukebox-front

Front-end de **Earth Jukebox** para el NASA Space Apps Challenge 2026.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS 4
- ESLint
- pnpm

## Desarrollo

```bash
pnpm install   # instalar dependencias
pnpm dev       # servidor de desarrollo en http://localhost:3000
pnpm build     # build de producción
pnpm start     # servir el build de producción
pnpm lint      # revisar el código con ESLint
```

El código fuente está en `src/app/`.

## Conexión con el backend (SpotiEarth API)

El front lee las playlists y tracks de la API desde Server Components (`src/lib/api/`).

| Variable  | Por defecto             | Uso                                   |
|-----------|-------------------------|---------------------------------------|
| `API_URL` | `http://localhost:8000` | URL base de la API (sin `/api/v1`)    |

Rutas:

- `/`: playlists de `GET /api/v1/playlists`; la portada es `cover_url` o el primer frame de su primera track.
- `/playlists/[slug]`: detalle de la playlist (`GET /api/v1/playlists/{slug}`), cada track con su imagen.
- `/playlists/[slug]/[track]`: reproductor con todos los frames de `GET /api/v1/tracks/{slug}`.
- `/globo`: tracks que se pueden ver desde dentro del globo; `/globo/[slug]/[track]` es el globo de una track (ver abajo).

### Imágenes de los frames

Las imágenes viven en `public/data_ingest_resources/<frames_directory>/` (la fuente de verdad),
donde `frames_directory` viene de `source_metadata` de cada track. La API lista los frames
con extensión `.png`/`.tif`, pero en `public/` son `.webp`, así que la URL de cada frame es:

```
/data_ingest_resources/<frames_directory>/<frame_id sin extensión>.webp
```

Si la track trae `source_metadata.frames_base_url` se usa esa carpeta en su lugar. El
`cover_url` de las playlists se normaliza igual (ruta absoluta y `.webp`). Ver `src/lib/api/frames.ts`.

## Globo interior (`/globo`)

Con [three.js](https://threejs.org): la cámara está en el centro de una esfera y los frames
de la track se reproducen sobre ella en secuencia, con un fundido de 1 s entre uno y otro
(sin fundido si el sistema pide reducir el movimiento).

- Solo aparecen las tracks con `engine_metadata.projection = "equirectangular"` (mapas 2:1).
  Las de `"globe"` ya son una esfera vista desde fuera y se ven solo en el reproductor, que
  muestra el botón del globo (🌐) cuando la track es compatible.
- **Escritorio**: arrastrar para mirar alrededor, rueda para el zoom. Teclado: ←/→ frame,
  ↑/↓ inclinar, +/− zoom, Espacio reproducir/pausar, R recentrar.
- **Móvil**: arrastrar o pellizcar; "Enable motion" usa el giroscopio (en iPhone pide
  permiso) y "Recenter" toma como frente la dirección a la que apunta el teléfono. El
  navegador solo da el sensor en HTTPS: para probarlo en el teléfono, `pnpm dev --experimental-https`.

Código:

| Ruta | Qué hace |
|---|---|
| `src/lib/globe/globe-scene.ts` | `GlobeScene`: renderer, cámara, bucle (solo pinta si algo cambia) y limpieza. Sin React. |
| `src/lib/globe/frame-sequence.ts` | Carga los frames en una ventana deslizante (el actual y los 3 siguientes) y libera el resto: la memoria no crece con la longitud de la secuencia. |
| `src/lib/globe/crossfade-material.ts` | Shader que funde un frame con el siguiente. |
| `src/lib/globe/sphere.ts` | Esfera interior a partir de `lat_range`/`lon_range` (un mapa parcial cae en su sitio). |
| `src/lib/globe/controls/` | Controles de cámara (`drag`, `orientation`) con una interfaz común; un modo nuevo se registra en `createControls`. |
| `src/components/globe/` | `GlobeViewer` (carga three.js con `import()`) y `GlobePlayer` (interfaz y reproducción). |

## Voz y sonido (accesibilidad)

- **Guía por voz**: viene **apagada por defecto**. Se elige el nivel con "Voice" en la barra superior o con el botón del megáfono en el reproductor, y la tecla **V** la enciende o apaga en cualquier página. La preferencia se guarda en el navegador.
  - **Off**: no habla.
  - **Full guide**: anuncia la playlist o la track al entrar y, al moverse con el teclado (Tab, Shift+Tab, flechas) lee cada botón, enlace o control ("Play, button", "Seek, slider, value 12") y, al cambiar de sección, en cuál estás ("Playback controls. …"). Las secciones se marcan con el atributo `data-voice-section`.
  - Quien usa un lector de pantalla (VoiceOver, TalkBack, NVDA) debería dejarla en Off para no oír dos voces. La lectura de botones solo se dispara con el teclado: los toques y los gestos del lector de pantalla del móvil no la activan.
- **Voz del mapa**: el switch **Map voice** (esquina superior derecha del mapa, o la tecla **M**) hace que al hacer clic sobre el mapa se diga el país y continente (o el mar/océano) bajo el cursor. Es independiente de la guía por voz, viene encendido y la preferencia se guarda en el navegador. Los lectores de pantalla reciben el nombre del lugar siempre, por una región `aria-live`.
- Los navegadores no permiten reproducir audio hasta la primera interacción: si se abre una página directamente por URL, la voz arranca con el primer toque, clic o tecla.

### Voz del navegador

La voz usa la síntesis de voz del propio navegador (Web Speech API), sin claves ni servicios externos. Se elige la mejor voz en inglés de EE. UU. disponible (en Edge, las voces "Natural" de Microsoft suenan muy bien). Funciona en Chrome para Android y en Safari para iOS; en iPhone no se oye con el interruptor de silencio activado.
