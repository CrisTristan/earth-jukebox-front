import { Euler, MathUtils, Quaternion, Vector3, type PerspectiveCamera } from "three";
import type { CameraControls } from "@/lib/globe/controls/types";

const { degToRad } = MathUtils;

/** Ángulos de `deviceorientation`, en grados. */
interface Orientation {
  alpha: number;
  beta: number;
  gamma: number;
}

// La cámara de three mira a -Z; el teléfono "mira" por su espalda, no hacia el techo:
// giro de -90° sobre X.
const PHONE_TO_CAMERA = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const Z_AXIS = new Vector3(0, 0, 1);

/**
 * La cámara sigue la orientación del teléfono: al girar sobre uno mismo se
 * recorre el interior del globo. Necesita `requestOrientationPermission()`
 * (`./orientation-permission.ts`) antes.
 */
export class OrientationControls implements CameraControls {
  private orientation: Orientation | null = null;
  private headingOffset = 0;
  private changed = false;
  private readonly euler = new Euler();
  private readonly screenTurn = new Quaternion();

  constructor() {
    window.addEventListener("deviceorientation", this.onOrientation);
  }

  /** Ya llegó alguna lectura del sensor (si no llega, el dispositivo no lo tiene). */
  get active(): boolean {
    return this.orientation !== null;
  }

  /** Hace que la dirección a la que apunta ahora el teléfono sea el "frente" del globo. */
  recenter(): void {
    if (!this.orientation) return;
    this.headingOffset = this.orientation.alpha;
    this.changed = true;
  }

  update(camera: PerspectiveCamera): boolean {
    if (!this.orientation || !this.changed) return false;
    this.changed = false;

    const { alpha, beta, gamma } = this.orientation;
    const screenAngle = degToRad(screen.orientation?.angle ?? 0); // vertical u horizontal

    this.euler.set(degToRad(beta), degToRad(alpha - this.headingOffset), -degToRad(gamma), "YXZ");
    camera.quaternion.setFromEuler(this.euler);
    camera.quaternion.multiply(PHONE_TO_CAMERA);
    camera.quaternion.multiply(this.screenTurn.setFromAxisAngle(Z_AXIS, -screenAngle));
    return true;
  }

  dispose(): void {
    window.removeEventListener("deviceorientation", this.onOrientation);
  }

  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.alpha === null) return;
    const first = this.orientation === null;
    this.orientation = { alpha: e.alpha, beta: e.beta ?? 90, gamma: e.gamma ?? 0 };
    // Al activar el sensor, el frente es hacia donde apunta el teléfono.
    if (first) this.headingOffset = e.alpha;
    this.changed = true;
  };
}
