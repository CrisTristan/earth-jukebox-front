import { DragControls } from "@/lib/globe/controls/drag-controls";
import { OrientationControls } from "@/lib/globe/controls/orientation-controls";
import type { CameraControls } from "@/lib/globe/controls/types";
import type { ControlMode } from "@/lib/globe/types";

export type { CameraControls } from "@/lib/globe/controls/types";
export { DragControls } from "@/lib/globe/controls/drag-controls";
export { OrientationControls } from "@/lib/globe/controls/orientation-controls";

/** Crea el control de cámara de cada modo. Un modo nuevo se registra aquí. */
export function createControls(mode: ControlMode, element: HTMLElement): CameraControls {
  switch (mode) {
    case "orientation":
      return new OrientationControls();
    case "drag":
      return new DragControls(element);
  }
}
