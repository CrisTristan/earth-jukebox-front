import { PerspectiveCamera, Scene, Timer, WebGLRenderer, type Mesh } from "three";
import type { CameraControls } from "@/lib/globe/controls/types";
import { CrossfadeMaterial } from "@/lib/globe/crossfade-material";
import { FrameSequence } from "@/lib/globe/frame-sequence";
import { createInteriorSphere } from "@/lib/globe/sphere";
import type { GeoBounds } from "@/lib/globe/types";

interface GlobeSceneOptions {
  /** Campo de visión inicial, en grados. */
  fov?: number;
  /** Frames que se mantienen cargados por delante del actual. */
  preload?: number;
  /** Se llama cuando el frame pedido ya se ve (útil para quitar un "cargando"). */
  onFrameShown?: (index: number) => void;
}

/** Segundos que tarda la mezcla en recorrer ~63 % de la distancia a su objetivo. */
const BLEND_EASE = 0.12;

/** El navegador puede crear un contexto WebGL. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Globo visto desde dentro: una esfera con una secuencia de imágenes y la
 * cámara en el centro.
 *
 * No depende de React: se monta en un contenedor y se controla con métodos.
 * - `setSequence(urls, bounds)`: cambia las imágenes (y la zona que cubren).
 * - `showFrame(index, blend)`: muestra el frame `index` fundido con el siguiente.
 * - `setControls(controls)`: cambia cómo se mueve la cámara (arrastre, giroscopio…).
 *
 * Solo vuelve a pintar cuando algo cambia (cámara, frame o tamaño), para no
 * gastar batería con la imagen quieta.
 */
export class GlobeScene {
  readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly material = new CrossfadeMaterial();
  private readonly timer = new Timer();
  private readonly resizeObserver: ResizeObserver;
  private readonly options: GlobeSceneOptions;
  private sphere: Mesh | null = null;
  private sequence: FrameSequence | null = null;
  private controls: CameraControls | null = null;
  private wanted = { index: 0, blend: 0 };
  private shown = -1;
  /** Mezcla que se ve ahora; se acerca a `wanted.blend` con suavidad en `tick`. */
  private blendShown = 0;
  private dirty = true;

  constructor(
    private readonly container: HTMLElement,
    options: GlobeSceneOptions = {},
  ) {
    this.options = options;
    this.camera = new PerspectiveCamera(options.fov ?? 75, 1, 0.1, 100);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.timer.connect(document);
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  /** El `<canvas>` (para colgar controles de puntero o teclado). */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Carga una nueva secuencia. `bounds` es la zona del planeta que cubre cada imagen. */
  setSequence(urls: readonly string[], bounds: GeoBounds): void {
    this.sequence?.dispose();
    this.sequence = new FrameSequence(urls, {
      window: this.options.preload ?? 4,
      anisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      // Sube la textura a la GPU al cargarla, no al mostrarla: así el cambio de frame no da tirones.
      prepare: (texture) => this.renderer.initTexture(texture),
      onLoad: () => this.applyFrame(),
    });

    if (this.sphere) {
      this.scene.remove(this.sphere);
      this.sphere.geometry.dispose();
    }
    this.sphere = createInteriorSphere({ bounds, material: this.material });
    this.scene.add(this.sphere);

    this.shown = -1;
    this.applyFrame();
  }

  /**
   * Muestra el frame `index`, fundido con el siguiente en la proporción `blend`
   * (0 = solo `index`, 1 = solo el siguiente). Mientras un frame carga se
   * mantiene el último que se vio, sin parpadeos.
   */
  showFrame(index: number, blend = 0): void {
    if (index === this.wanted.index && blend === this.wanted.blend) return;
    this.wanted = { index, blend };
    this.applyFrame();
  }

  /** Cambia el control de la cámara; el anterior se libera. */
  setControls(controls: CameraControls | null): void {
    if (controls === this.controls) return;
    this.controls?.dispose();
    this.controls = controls;
    this.dirty = true;
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.controls?.dispose();
    this.sequence?.dispose();
    this.sphere?.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private applyFrame(): void {
    const sequence = this.sequence;
    if (!sequence || sequence.length === 0) return;
    const { index, blend } = this.wanted;
    sequence.focus(index);

    const from = sequence.get(index);
    if (!from) return; // aún cargando: se queda el último frame visible
    const to = sequence.get(index + 1);
    // Al cambiar de frame (o al saltar con el slider) la mezcla no se anima: se fija.
    if (this.shown !== index) this.blendShown = to ? blend : 0;
    this.material.setFrames(from, to ?? from, to ? this.blendShown : 0);
    this.dirty = true;

    if (this.shown !== index) {
      this.shown = index;
      this.options.onFrameShown?.(index);
    }
  }

  /** Acerca la mezcla visible a la pedida (la interfaz la actualiza a saltos). */
  private easeBlend(dt: number): void {
    const { uTo, uFrom } = this.material.uniforms;
    const target = uTo.value !== uFrom.value ? this.wanted.blend : 0;
    const diff = target - this.blendShown;
    if (diff === 0) return;
    this.blendShown = Math.abs(diff) < 0.002 ? target : this.blendShown + diff * (1 - Math.exp(-dt / BLEND_EASE));
    this.material.uniforms.uMix.value = this.blendShown;
    this.dirty = true;
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.dirty = true;
  }

  private tick(time: number): void {
    this.timer.update(time);
    const dt = this.timer.getDelta();
    this.easeBlend(dt);
    const moved = this.controls?.update(this.camera, dt) ?? false;
    if (!moved && !this.dirty) return;
    this.dirty = false;
    if (this.material.ready) this.renderer.render(this.scene, this.camera);
  }
}
