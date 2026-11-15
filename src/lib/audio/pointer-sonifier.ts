/**
 * Sonido que sigue al puntero sobre el mapa (Web Audio).
 *
 * - Panorama: izquierda/derecha según la longitud.
 * - Nota: el dato bajo el puntero (p. ej. NDVI), en una escala pentatónica de
 *   La3 a La5: más valor, nota más aguda. Siempre suena consonante.
 * - Sin dato (mar, fuera de la cuadrícula): un tono grave y suave, como agua.
 * - Al cruzar a otro país u océano, un "tic" breve marca la frontera.
 *
 * El AudioContext solo puede arrancar tras un gesto de la persona: `unlock()`
 * se llama en el primer `pointerdown`/tecla.
 */

const A3 = 220;
const PENTATONIC = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // La menor pentatónica, dos octavas
const WATER_HZ = 110;
const GLIDE = 0.04; // s
const TONE_GAIN = 0.12;
const WATER_GAIN = 0.05;

export interface SonifierUpdate {
  /** -1 (oeste) … 1 (este). */
  pan: number;
  /** Dato normalizado 0–1, o null si no hay dato. */
  level: number | null;
}

export class PointerSonifier {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private master: GainNode | null = null;
  private volume = 0.7;
  private muted = false;

  /** Crea o reanuda el audio. Llamar desde un gesto (clic, tecla). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const panner = ctx.createStereoPanner();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      osc.connect(filter).connect(gain).connect(panner).connect(master).connect(ctx.destination);
      osc.start();
      Object.assign(this, { ctx, osc, filter, gain, panner, master });
    }
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private get ready() {
    return this.ctx?.state === "running";
  }

  update({ pan, level }: SonifierUpdate) {
    if (!this.ready || !this.ctx || !this.osc || !this.gain || !this.panner || !this.filter) return;
    const t = this.ctx.currentTime;
    this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, GLIDE);
    if (level == null) {
      this.osc.frequency.setTargetAtTime(WATER_HZ, t, GLIDE * 2);
      this.filter.frequency.setTargetAtTime(400, t, GLIDE);
      this.gain.gain.setTargetAtTime(WATER_GAIN, t, GLIDE);
    } else {
      const step = PENTATONIC[Math.round(Math.max(0, Math.min(1, level)) * (PENTATONIC.length - 1))]!;
      this.osc.frequency.setTargetAtTime(A3 * 2 ** (step / 12), t, GLIDE);
      this.filter.frequency.setTargetAtTime(1800, t, GLIDE);
      this.gain.gain.setTargetAtTime(TONE_GAIN, t, GLIDE);
    }
  }

  /** "Tic" corto al cruzar una frontera. */
  tick() {
    if (!this.ready || !this.ctx || !this.panner) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1320;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.08, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    osc.connect(env).connect(this.panner);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  /** Fundido a silencio (el puntero salió del mapa). */
  silence() {
    if (!this.ctx || !this.gain) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, GLIDE * 2);
  }

  /** Volumen general 0–1. */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyMaster();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMaster();
  }

  private applyMaster() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, GLIDE);
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = this.osc = this.filter = this.gain = this.panner = this.master = null;
  }
}
