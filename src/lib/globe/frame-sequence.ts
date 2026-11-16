import { ImageBitmapLoader, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from "three";

interface FrameSequenceOptions {
  /** Frames que se mantienen cargados: el actual y los `window − 1` siguientes. */
  window?: number;
  /** Se llama con cada textura recién cargada (p. ej. para subirla ya a la GPU). */
  prepare?: (texture: Texture) => void;
  /** Se llama cuando un frame termina de cargar. */
  onLoad?: (index: number) => void;
  /** Anisotropía de las texturas (nitidez cerca de los polos). */
  anisotropy?: number;
}

type Slot = { state: "loading" } | { state: "failed" } | { state: "ready"; texture: Texture };

/**
 * Secuencia de imágenes cargadas **bajo demanda**, en una ventana deslizante.
 *
 * Un frame de 1920×960 ocupa ~7 MB de GPU: con 32 frames serían más de 200 MB.
 * Aquí solo viven el frame actual y los siguientes (el bucle vuelve al principio),
 * y los que salen de la ventana se liberan. El coste no crece con la longitud de
 * la secuencia, así que sirve igual para 12 frames que para 500.
 *
 * Las imágenes se decodifican fuera del hilo principal con `ImageBitmapLoader`,
 * para no congelar la animación al cambiar de frame.
 */
export class FrameSequence {
  private readonly slots = new Map<number, Slot>();
  private readonly loader = new ImageBitmapLoader().setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });
  private readonly window: number;
  private disposed = false;

  constructor(
    private readonly urls: readonly string[],
    private readonly options: FrameSequenceOptions = {},
  ) {
    this.window = Math.max(1, Math.min(options.window ?? 4, urls.length));
  }

  get length(): number {
    return this.urls.length;
  }

  /** Textura del frame `index` si ya está cargada. */
  get(index: number): Texture | null {
    const slot = this.slots.get(this.wrap(index));
    return slot?.state === "ready" ? slot.texture : null;
  }

  /** Mueve la ventana a `index`: carga lo que falte y libera lo que sobra. */
  focus(index: number): void {
    if (this.disposed || this.length === 0) return;
    const wanted = new Set<number>();
    for (let i = 0; i < this.window; i++) wanted.add(this.wrap(index + i));

    for (const [i, slot] of this.slots) {
      if (wanted.has(i)) continue;
      if (slot.state === "ready") release(slot.texture);
      this.slots.delete(i);
    }
    // En orden: primero el frame actual, luego los siguientes.
    for (const i of wanted) if (!this.slots.has(i)) this.load(i);
  }

  dispose(): void {
    this.disposed = true;
    for (const slot of this.slots.values()) if (slot.state === "ready") release(slot.texture);
    this.slots.clear();
  }

  private wrap(index: number): number {
    const n = this.length;
    return ((index % n) + n) % n;
  }

  private load(index: number): void {
    const slot: Slot = { state: "loading" };
    this.slots.set(index, slot);
    this.loader.load(
      this.urls[index],
      (bitmap) => {
        const texture = new Texture(bitmap);
        // El bitmap ya viene girado (`imageOrientation: "flipY"`).
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.anisotropy = this.options.anisotropy ?? 1;
        texture.needsUpdate = true;

        // Se salió de la ventana (o se cerró la secuencia) mientras cargaba.
        if (this.disposed || this.slots.get(index) !== slot) {
          release(texture);
          return;
        }
        this.options.prepare?.(texture);
        this.slots.set(index, { state: "ready", texture });
        this.options.onLoad?.(index);
      },
      undefined,
      () => {
        // Error de red: no se reintenta mientras siga en la ventana (`focus` se llama
        // muchas veces por segundo); se volverá a pedir en la siguiente vuelta.
        if (this.slots.get(index) === slot) this.slots.set(index, { state: "failed" });
      },
    );
  }
}

/** Libera la textura en la GPU y el bitmap en memoria. */
function release(texture: Texture): void {
  texture.dispose();
  const image = texture.image as ImageBitmap | undefined;
  image?.close?.();
}
