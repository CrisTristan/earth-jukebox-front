import { ShaderMaterial, type Texture } from "three";

/** Uniforms del material de fundido. */
export interface CrossfadeUniforms {
  uFrom: { value: Texture | null };
  uTo: { value: Texture | null };
  /** 0 = solo `uFrom`, 1 = solo `uTo`. */
  uMix: { value: number };
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Las texturas están en sRGB: three las pasa a lineal al leerlas y
// `colorspace_fragment` las devuelve al espacio de color de salida.
const fragmentShader = /* glsl */ `
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform float uMix;
  varying vec2 vUv;
  void main() {
    vec4 from = texture2D(uFrom, vUv);
    vec4 to = texture2D(uTo, vUv);
    gl_FragColor = vec4(mix(from.rgb, to.rgb, uMix), 1.0);
    #include <colorspace_fragment>
  }
`;

/** Material que funde dos frames consecutivos de la secuencia. */
export class CrossfadeMaterial extends ShaderMaterial {
  declare uniforms: CrossfadeUniforms & ShaderMaterial["uniforms"];

  constructor() {
    super({
      uniforms: { uFrom: { value: null }, uTo: { value: null }, uMix: { value: 0 } },
      vertexShader,
      fragmentShader,
      depthWrite: false,
    });
  }

  /** Muestra `from` fundido con `to` en la proporción `mix` (0–1). */
  setFrames(from: Texture, to: Texture, mix: number): void {
    this.uniforms.uFrom.value = from;
    this.uniforms.uTo.value = to;
    this.uniforms.uMix.value = Math.min(1, Math.max(0, mix));
  }

  /** Hay algo que pintar (al menos el primer frame cargado). */
  get ready(): boolean {
    return this.uniforms.uFrom.value !== null;
  }
}
