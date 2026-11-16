import { Euler, MathUtils, type PerspectiveCamera } from "three";
import type { CameraControls } from "@/lib/globe/controls/types";

const { degToRad, clamp } = MathUtils;

interface DragControlsOptions {
  minFov?: number;
  maxFov?: number;
  /** Límite de inclinación hacia arriba y hacia abajo, en grados. */
  maxPitch?: number;
  /** Cuánto se conserva la velocidad por segundo al soltar (0 = sin inercia). */
  inertia?: number;
}

const ZOOM_STEP = 0.05; // fracción del fov por "clic" de rueda

/**
 * Mirar alrededor arrastrando (ratón o dedo) y hacer zoom con la rueda o
 * pellizcando. El contenido sigue al puntero, como en una foto de 360°.
 * El teclado lo maneja la interfaz con `rotateBy` y `zoomBy`.
 */
export class DragControls implements CameraControls {
  private yaw = 0;
  private pitch = 0;
  private velocityYaw = 0;
  private velocityPitch = 0;
  private fov: number | null = null;
  private initialFov: number | null = null;
  private dirty = true;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private lastMove = 0;
  private readonly euler = new Euler(0, 0, 0, "YXZ");
  private readonly minFov: number;
  private readonly maxFov: number;
  private readonly maxPitch: number;
  private readonly inertia: number;

  constructor(
    private readonly element: HTMLElement,
    options: DragControlsOptions = {},
  ) {
    this.minFov = options.minFov ?? 30;
    this.maxFov = options.maxFov ?? 95;
    this.maxPitch = degToRad(options.maxPitch ?? 85);
    this.inertia = options.inertia ?? 0.04;

    element.style.touchAction = "none";
    element.style.cursor = "grab";
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("wheel", this.onWheel, { passive: false });
  }

  recenter(): void {
    this.yaw = this.pitch = 0;
    this.velocityYaw = this.velocityPitch = 0;
    if (this.initialFov !== null) this.fov = this.initialFov;
    this.dirty = true;
  }

  rotateBy(dYaw: number, dPitch: number): void {
    this.velocityYaw = this.velocityPitch = 0;
    this.rotate(dYaw, dPitch);
  }

  zoomBy(factor: number): void {
    this.zoom(factor);
  }

  update(camera: PerspectiveCamera, dt: number): boolean {
    if (this.fov === null) this.fov = this.initialFov = camera.fov;

    // Inercia al soltar: la velocidad decae de forma exponencial.
    if (this.pointers.size === 0 && (this.velocityYaw !== 0 || this.velocityPitch !== 0)) {
      this.rotate(this.velocityYaw * dt, this.velocityPitch * dt);
      const decay = Math.pow(this.inertia, dt);
      this.velocityYaw *= decay;
      this.velocityPitch *= decay;
      if (Math.abs(this.velocityYaw) < 1e-3 && Math.abs(this.velocityPitch) < 1e-3) {
        this.velocityYaw = this.velocityPitch = 0;
      }
    }

    if (!this.dirty) return false;
    this.dirty = false;
    this.euler.set(this.pitch, this.yaw, 0);
    camera.quaternion.setFromEuler(this.euler);
    if (camera.fov !== this.fov) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
    return true;
  }

  dispose(): void {
    const el = this.element;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("wheel", this.onWheel);
    el.style.cursor = "";
    el.style.touchAction = "";
  }

  /** Radianes por píxel: con más zoom, el mismo gesto gira menos. */
  private get radiansPerPixel(): number {
    return degToRad(this.fov ?? 75) / Math.max(1, this.element.clientHeight);
  }

  private rotate(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, -this.maxPitch, this.maxPitch);
    this.dirty = true;
  }

  private zoom(factor: number): void {
    const current = this.fov ?? 75;
    this.fov = clamp(current * factor, this.minFov, this.maxFov);
    this.dirty = true;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    this.element.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.velocityYaw = this.velocityPitch = 0;
    this.lastMove = performance.now();
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinchDistance();
    this.element.style.cursor = "grabbing";
  };

  private onPointerMove = (e: PointerEvent) => {
    const last = this.pointers.get(e.pointerId);
    if (!last) return;
    const point = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, point);

    if (this.pointers.size >= 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchDistance > 0 && distance > 0) this.zoom(this.pinchDistance / distance);
      this.pinchDistance = distance;
      return;
    }

    const k = this.radiansPerPixel;
    const dYaw = (point.x - last.x) * k;
    const dPitch = (point.y - last.y) * k;
    this.rotate(dYaw, dPitch);

    const now = performance.now();
    const dt = Math.max(1, now - this.lastMove) / 1000;
    this.lastMove = now;
    this.velocityYaw = dYaw / dt;
    this.velocityPitch = dPitch / dt;
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
    // Si el puntero se quedó quieto antes de soltar, no hay inercia.
    if (performance.now() - this.lastMove > 80) this.velocityYaw = this.velocityPitch = 0;
    if (this.pointers.size === 0) this.element.style.cursor = "grab";
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom(e.deltaY > 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP);
  };

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
