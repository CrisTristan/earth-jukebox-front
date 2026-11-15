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

### Imágenes de los frames

Las imágenes viven en `public/frames/<slug-de-la-track>/` y la URL de cada frame es
`frames_base_url + "/" + frame_id`. Si la track no trae `source_metadata.frames_base_url`,
se usa `/frames/<slug>`. Al ingestar en el backend conviene pasar `--frames-url /frames/<slug>`.

Para copiar las imágenes del backend al front (solo las que lista la API):

```bash
pnpm sync:frames
# opciones: --api http://localhost:8000 --backend ../spotiearth-backend/app/test_images
```

## Voz y sonido (accesibilidad)

- **Guía por voz**: al entrar en una playlist se dice cuál elegiste. En el reproductor, al hacer clic sobre el mapa se dice el país y continente (o el mar/océano) bajo el cursor. Se activa o desactiva con "Voice" en la barra superior o con el botón del megáfono en el reproductor; la preferencia se guarda en el navegador.
- **Sonido bajo el cursor**: al mover el ratón sobre el mapa suena una nota que sube con el dato de ese punto (p. ej. más vegetación, nota más aguda), se desplaza a izquierda/derecha según la longitud, suena grave y suave sobre el mar y hace un "tic" al cruzar una frontera.
- Los navegadores no permiten reproducir audio hasta la primera interacción: si se abre una página directamente por URL, la voz y el sonido arrancan con el primer toque, clic o tecla.

### Voz del navegador

La voz usa la síntesis de voz del propio navegador (Web Speech API), sin claves ni servicios externos. Se elige la mejor voz en inglés de EE. UU. disponible (en Edge, las voces "Natural" de Microsoft suenan muy bien). Funciona en Chrome para Android y en Safari para iOS; en iPhone no se oye con el interruptor de silencio activado.
