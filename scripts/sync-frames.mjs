#!/usr/bin/env node
/**
 * Copia al front las imágenes de cada track del backend.
 *
 * Recorre la API (playlists → tracks → frames) y copia cada `frame_id` desde la
 * carpeta del backend a `public/frames/<slug-de-la-track>/`, que es la ruta por
 * defecto que usa el front cuando la track no trae `frames_base_url`.
 *
 * Solo copia los archivos que la API lista: si sobra una imagen en el backend
 * no se copia, y si falta una se avisa.
 *
 * Uso:
 *   pnpm sync:frames
 *   pnpm sync:frames -- --backend ../spotiearth-backend/app/test_images --api http://localhost:8000
 *
 * Variables de entorno equivalentes: BACKEND_FRAMES_DIR, API_URL.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "frames");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const API_URL = arg("api", process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const BACKEND_DIR = path.resolve(
  ROOT,
  arg("backend", process.env.BACKEND_FRAMES_DIR ?? "../spotiearth-backend/app/test_images"),
);

async function getJson(route) {
  const res = await fetch(`${API_URL}/api/v1${route}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${route} → HTTP ${res.status}`);
  return res.json();
}

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/**
 * `frames_directory` es solo el nombre de la carpeta en el backend. Se busca
 * dentro de la carpeta de imágenes y, si no, en su carpeta padre (caso de
 * frames guardados directamente en `test_images/`).
 */
async function findSource(framesDirectory, frameId) {
  const candidates = [
    path.join(BACKEND_DIR, framesDirectory, frameId),
    path.join(path.dirname(BACKEND_DIR), framesDirectory, frameId),
  ];
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

async function main() {
  console.log(`API: ${API_URL}\nBackend: ${BACKEND_DIR}\nDestino: ${OUT_DIR}\n`);
  const playlists = await getJson("/playlists");
  let copied = 0;
  let missing = 0;

  for (const summary of playlists) {
    const playlist = await getJson(`/playlists/${encodeURIComponent(summary.slug)}`);
    for (const { slug } of playlist.tracks) {
      const track = await getJson(`/tracks/${encodeURIComponent(slug)}`);
      const meta = track.source_metadata ?? {};
      if (meta.frames_base_url && !String(meta.frames_base_url).startsWith(`/frames/${slug}`)) {
        console.warn(`! ${slug}: frames_base_url=${meta.frames_base_url} no apunta a /frames/${slug}; se copia igualmente ahí.`);
      }
      const destDir = path.join(OUT_DIR, slug);
      await mkdir(destDir, { recursive: true });

      for (const frame of track.frames) {
        const source = meta.frames_directory ? await findSource(meta.frames_directory, frame.frame_id) : null;
        if (!source) {
          console.warn(`✗ ${slug}/${frame.frame_id}: no está en el backend (frames_directory=${meta.frames_directory})`);
          missing++;
          continue;
        }
        await copyFile(source, path.join(destDir, frame.frame_id));
        copied++;
      }
      console.log(`✓ ${playlist.slug} / ${slug}: ${track.frames.length} frames`);
    }
  }

  console.log(`\n${copied} imágenes copiadas${missing ? `, ${missing} no encontradas` : ""}.`);
  if (missing) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
