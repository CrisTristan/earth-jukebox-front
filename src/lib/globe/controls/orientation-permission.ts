/**
 * Permiso del sensor de orientación. Sin three.js a propósito: lo importa la
 * interfaz directamente, sin arrastrar el motor 3D al bundle inicial.
 */

type OrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

/** El navegador expone el sensor de orientación (no garantiza que el dispositivo lo tenga). */
export function supportsOrientation(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

/**
 * Pide permiso para leer el sensor. En iPhone y iPad es obligatorio y debe
 * llamarse desde un toque o clic; en Android no hace falta y devuelve `true`.
 * Fuera de HTTPS (o localhost) el navegador no da acceso al sensor.
 */
export async function requestOrientationPermission(): Promise<boolean> {
  if (!supportsOrientation() || !window.isSecureContext) return false;
  const DOE = DeviceOrientationEvent as OrientationEventWithPermission;
  if (typeof DOE.requestPermission !== "function") return true;
  try {
    return (await DOE.requestPermission()) === "granted";
  } catch {
    return false;
  }
}
