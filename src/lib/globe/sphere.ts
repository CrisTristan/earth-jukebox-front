import { Mesh, SphereGeometry, type Material } from "three";
import { MathUtils } from "three";
import type { GeoBounds } from "@/lib/globe/types";

const { degToRad } = MathUtils;

interface InteriorSphereOptions {
  bounds: GeoBounds;
  material: Material;
  radius?: number;
  /** Longitud que queda delante de la cámara al empezar (mirando hacia -Z). */
  frontLongitude?: number;
  widthSegments?: number;
  heightSegments?: number;
}

/**
 * Esfera para ver un mapa equirectangular **desde dentro**.
 *
 * Solo genera la parte de la esfera que cubre `bounds`, con UV de 0 a 1 en esa
 * zona: un mapa parcial (un hemisferio, un continente) queda en su sitio sin
 * recortar ni estirar la imagen.
 *
 * En `SphereGeometry`, la longitud L está en `phi = L + 180°` y la latitud en
 * `theta = 90° − lat` (desde el polo norte). `scale(-1, 1, 1)` da la vuelta a las
 * caras para verlas desde dentro y, a la vez, evita que el mapa se vea en espejo.
 */
export function createInteriorSphere({
  bounds,
  material,
  radius = 10,
  frontLongitude = 0,
  widthSegments = 96,
  heightSegments = 48,
}: InteriorSphereOptions): Mesh {
  const [latTop, latBottom] = bounds.latRange;
  const [lonLeft, lonRight] = bounds.lonRange;

  const geometry = new SphereGeometry(
    radius,
    widthSegments,
    heightSegments,
    degToRad(lonLeft + 180),
    degToRad(lonRight - lonLeft),
    degToRad(90 - latTop),
    degToRad(latTop - latBottom),
  );
  geometry.scale(-1, 1, 1);

  const mesh = new Mesh(geometry, material);
  // Tras el `scale`, la longitud L queda en el ángulo `phi` medido de +X hacia +Z.
  // Girando `phi + 90°` sobre Y, esa longitud pasa a -Z: delante de la cámara.
  mesh.rotation.y = degToRad(frontLongitude + 180) + Math.PI / 2;
  return mesh;
}
