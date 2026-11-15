/** Tipos compartidos del globo (núcleo three.js y componentes React). */

/** Zona del planeta que cubre cada imagen de la secuencia (proyección equirectangular). */
export interface GeoBounds {
  /** Latitud del borde superior y del inferior, p. ej. `[90, -90]`. */
  latRange: [number, number];
  /** Longitud del borde izquierdo y del derecho, p. ej. `[-180, 180]`. */
  lonRange: [number, number];
}

/** Mapa del mundo completo: lo que trae el motor si no indica otra cosa. */
export const WORLD_BOUNDS: GeoBounds = { latRange: [90, -90], lonRange: [-180, 180] };

/** Modo de control de la cámara. */
export type ControlMode = "drag" | "orientation";
