import type { PerspectiveCamera } from "three";

/**
 * Control de la cámara del globo. La escena llama a `update` en cada fotograma;
 * para añadir otro modo (p. ej. un recorrido automático) basta con implementar
 * esta interfaz y registrarlo en `createControls` (`./index.ts`).
 */
export interface CameraControls {
  /**
   * Coloca la cámara. Devuelve `true` si algo cambió y hay que volver a pintar.
   * @param dt segundos desde el fotograma anterior.
   */
  update(camera: PerspectiveCamera, dt: number): boolean;
  /** Vuelve a mirar al frente del globo. */
  recenter(): void;
  /** Gira la vista (radianes); opcional para controles que no lo permiten. */
  rotateBy?(dYaw: number, dPitch: number): void;
  /** Multiplica el campo de visión (< 1 acerca, > 1 aleja). */
  zoomBy?(factor: number): void;
  /** Retira los listeners. */
  dispose(): void;
}
