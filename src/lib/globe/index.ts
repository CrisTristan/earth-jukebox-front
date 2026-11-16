/**
 * Motor 3D del globo (three.js). Se importa con `import()` desde el cliente
 * para que three.js solo se descargue en las páginas del globo.
 */
export { GlobeScene, supportsWebGL, type GlobeView } from "@/lib/globe/globe-scene";
export { createControls, DragControls, OrientationControls, type CameraControls } from "@/lib/globe/controls";
