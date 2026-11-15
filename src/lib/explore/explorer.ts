/**
 * Motor del disco de exploración: sonido (Web Audio), reloj de la vuelta y dibujo
 * en canvas. Es un port directo de "Capas de la Tierra" (`index.html`): las mismas
 * camas de naturaleza, los mismos detalles y el mismo disco con su flecha.
 *
 * No depende de React: el componente le pasa la cuadrícula y los eventos.
 */
import { stepAngle, type DiscGrid } from "@/lib/explore/disc";
import type { DataBand } from "@/lib/player";

/**
 * Voces del disco, de la más calmada a la más intensa. Son los sonidos del prototipo:
 * 0 aire suave, 1 olas lentas, 2 grava y retumbo, 3 cristal. Cada nivel del dato usa una.
 */
export const VOICES = ["Soft air", "Slow waves", "Gravel and rumble", "Crystal"] as const;
const VOICE_LIST = [0, 1, 2, 3] as const;
type Voice = (typeof VOICE_LIST)[number];

/** Una vuelta completa dura `TURN_SECONDS / velocidad` segundos. */
const TURN_SECONDS = 12;
const ESCALA = [0, 2, 4, 7, 9];
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** Volumen de la cama de cada voz (mismas proporciones que el prototipo). */
const NIVEL: Record<Voice, number> = { 0: 0.34, 1: 0.62, 2: 1.5, 3: 0.1 };

interface Bed {
  gain: GainNode;
  pan: StereoPannerNode;
}

interface Audio {
  ctx: AudioContext;
  master: GainNode;
  puerta: GainNode;
  reverb: ConvolverNode;
  white: AudioBuffer;
  beds: Record<Voice, Bed>;
  voces: GainNode;
}

export interface ExplorerEvents {
  /** Cambió la posición de la flecha (en pasos, con decimales). Se llama en cada fotograma. */
  onPosition?: (pos: number) => void;
  /** Empezó o paró la vuelta. */
  onPlaying?: (playing: boolean) => void;
}

export class Explorer {
  private grid: DiscGrid | null = null;
  private audio: Audio | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private reach = 6;
  private speed = 1;
  private volume = 75;
  private bands: DataBand[] = [];
  /** Niveles apagados por la persona. */
  private muted = new Set<number>();

  private playing = false;
  private inicio = 0;
  private paso = 0;
  private durPaso = 0.25;
  private posPausa = 0;
  private reloj = 0;
  private raf = 0;
  private ultimoPaso = -1;
  private apagado = 0;
  private duckTimer = 0;
  /** Arrastre de la flecha sobre el disco. */
  private drag: { wasPlaying: boolean; x: number; y: number; moved: boolean; tip: boolean } | null = null;
  private tipX = 0;
  private tipY = 0;
  private discRadius = 400;
  private core = 40;

  private events: ExplorerEvents = {};

  /** Callbacks hacia la interfaz. */
  on(events: ExplorerEvents) {
    this.events = events;
  }

  // ---- Configuración ----

  attach(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.draw();
  }

  setGrid(grid: DiscGrid | null) {
    const prev = this.grid;
    const part = prev ? this.position() / prev.steps : 0;
    this.grid = grid;
    if (grid && prev && prev.steps !== grid.steps) {
      // Misma fracción de la vuelta con la nueva resolución.
      if (this.playing) this.from(part * grid.steps);
      else this.posPausa = part * grid.steps;
    }
    if (grid) this.reach = Math.max(1, Math.min(grid.rings, this.reach));
    if (!this.playing) this.draw();
  }

  get rings() {
    return this.grid?.rings ?? 0;
  }

  getReach() {
    return this.reach;
  }

  setReach(n: number): number {
    const max = this.grid?.rings ?? 1;
    this.reach = Math.max(1, Math.min(max, Math.round(n)));
    if (!this.playing) this.draw();
    return this.reach;
  }

  setSpeed(speed: number) {
    this.speed = speed;
    if (this.playing) this.from(this.position());
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.audio) this.audio.master.gain.value = (volume / 100) * 1.6;
  }

  setBands(bands: DataBand[]) {
    this.bands = bands;
    if (!this.playing) this.draw();
  }

  setActive(band: number, on: boolean) {
    if (on) this.muted.delete(band);
    else this.muted.add(band);
    if (!this.playing) this.draw();
  }

  isPlaying() {
    return this.playing;
  }

  /** Paso en el que está la flecha. */
  currentStep(): number {
    const steps = this.grid?.steps ?? 1;
    return Math.floor(this.position()) % steps;
  }

  /** Posición de la flecha en pasos (con decimales). */
  position(): number {
    const steps = this.grid?.steps ?? 1;
    if (!this.playing || !this.audio) return this.posPausa;
    return ((((this.audio.ctx.currentTime - this.inicio) / this.durPaso) % steps) + steps) % steps;
  }

  // ---- Reproducción ----

  /** Reproducir o pausar la vuelta. Llamar dentro de un gesto (crea el audio). */
  async toggle(): Promise<void> {
    if (this.playing) {
      this.stopClock();
      this.silence();
      this.draw();
      return;
    }
    if (!(await this.ensureAudio())) return;
    this.startClock(this.posPausa);
  }

  pause() {
    if (!this.playing) return;
    this.stopClock();
    this.silence();
    this.draw();
  }

  /** Mueve la flecha un paso (←/→) y suena ese paso. */
  async stepBy(d: number) {
    const grid = this.grid;
    if (!grid || !(await this.ensureAudio())) return;
    if (this.playing) this.stopClock();
    this.ultimoPaso = -1;
    this.hearAt((Math.floor(this.posPausa) + d + grid.steps) % grid.steps);
    window.clearTimeout(this.apagado);
    this.apagado = window.setTimeout(() => {
      if (!this.playing && !this.drag) this.silence();
    }, 900);
  }

  // ---- Arrastre sobre el disco ----

  async pointerDown(e: PointerEvent) {
    const c = this.canvas;
    if (!c) return;
    void this.ensureAudio();
    c.setPointerCapture(e.pointerId);
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    const nearTip = Math.hypot((e.clientX - r.left) * k - this.tipX, (e.clientY - r.top) * k - this.tipY) < 70;
    this.drag = { wasPlaying: this.playing, x: e.clientX, y: e.clientY, moved: false, tip: nearTip };
    if (this.playing) {
      this.stopClock();
      this.cut();
    }
    this.draw();
  }

  pointerMove(e: PointerEvent): number | null {
    const c = this.canvas;
    const drag = this.drag;
    const grid = this.grid;
    if (!c || !drag || !grid) return null;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return null;
    const r = c.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width / 2;
    const dy = e.clientY - r.top - r.height / 2;
    if (Math.hypot(dx, dy) < r.width * 0.06) return null;
    drag.moved = true;
    if (drag.tip) {
      const d = Math.hypot(dx, dy) * (c.width / r.width);
      this.reach = Math.max(1, Math.min(grid.rings, Math.round(((d - this.core) / (this.discRadius - this.core)) * grid.rings)));
    }
    const pos = ((((Math.atan2(dy, dx) + Math.PI / 2) / (2 * Math.PI)) % 1) + 1) % 1 * grid.steps;
    this.hearAt(pos);
    return this.reach;
  }

  /** Suelta la flecha. Devuelve true si fue un toque (sin arrastrar). */
  pointerUp(): "tap" | "drag" | null {
    const drag = this.drag;
    if (!drag) return null;
    this.drag = null;
    this.ultimoPaso = -1;
    if (!drag.moved) {
      if (drag.wasPlaying) {
        this.silence();
        this.draw();
      } else {
        void this.toggle();
      }
      return "tap";
    }
    if (drag.wasPlaying) this.startClock(this.posPausa);
    else {
      this.silence();
      this.draw();
    }
    return "drag";
  }

  dispose() {
    this.stopClock();
    window.clearTimeout(this.apagado);
    window.clearInterval(this.duckTimer);
    const a = this.audio;
    this.audio = null;
    void a?.ctx.close().catch(() => {});
  }

  // ---- Reloj ----

  private startClock(pos: number) {
    this.open();
    this.from(pos);
    this.playing = true;
    this.events.onPlaying?.(true);
    window.clearInterval(this.reloj);
    this.reloj = window.setInterval(() => this.schedule(), 40);
    this.loop();
  }

  private stopClock() {
    const wasPlaying = this.playing;
    this.posPausa = this.position();
    this.playing = false;
    window.clearInterval(this.reloj);
    cancelAnimationFrame(this.raf);
    if (wasPlaying) this.events.onPlaying?.(false);
  }

  private from(pos: number) {
    const a = this.audio;
    const steps = this.grid?.steps ?? 48;
    if (!a) return;
    this.durPaso = TURN_SECONDS / steps / this.speed;
    this.inicio = a.ctx.currentTime + 0.06 - pos * this.durPaso;
    this.paso = Math.ceil(pos);
  }

  private schedule() {
    const a = this.audio;
    const grid = this.grid;
    if (!a || !grid || !this.playing) return;
    while (this.inicio + this.paso * this.durPaso < a.ctx.currentTime + 0.2) {
      this.soundStep(this.paso % grid.steps, this.inicio + this.paso * this.durPaso);
      this.paso++;
    }
  }

  private loop = () => {
    this.draw();
    if (this.playing) this.raf = requestAnimationFrame(this.loop);
  };

  private hearAt(pos: number) {
    const grid = this.grid;
    const a = this.audio;
    if (!grid) return;
    this.open();
    this.posPausa = pos;
    const j = Math.floor(pos) % grid.steps;
    if (a && j !== this.ultimoPaso) {
      this.ultimoPaso = j;
      this.soundStep(j, a.ctx.currentTime + 0.01);
    }
    this.draw();
  }

  // ---- Audio ----

  private ensureAudio(): Promise<boolean> {
    try {
      this.audio ??= this.buildAudio();
      return this.audio.ctx.resume().then(() => true, () => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  private buildAudio(): Audio {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = (this.volume / 100) * 1.6;
    const comp = ctx.createDynamicsCompressor();
    const puerta = ctx.createGain();
    master.connect(comp);
    comp.connect(puerta);
    // Baja el radar mientras habla la voz (anuncios del origen, guía), para que se entienda.
    const duck = ctx.createGain();
    puerta.connect(duck);
    duck.connect(ctx.destination);
    window.clearInterval(this.duckTimer);
    this.duckTimer = window.setInterval(() => {
      const speaking = typeof speechSynthesis !== "undefined" && speechSynthesis.speaking;
      duck.gain.setTargetAtTime(speaking ? 0.3 : 1, ctx.currentTime, 0.08);
    }, 150);

    const n = ctx.sampleRate * 2;
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    reverb.connect(wet);
    wet.connect(master);

    const largo = ctx.sampleRate * 4;
    const white = ctx.createBuffer(1, largo, ctx.sampleRate);
    const brown = ctx.createBuffer(1, largo, ctx.sampleRate);
    const w = white.getChannelData(0);
    const m = brown.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < largo; i++) {
      w[i] = Math.random() * 2 - 1;
      ult = (ult + 0.02 * w[i]!) / 1.02;
      m[i] = ult * 3.5;
    }

    const bed = (buffer: AudioBuffer, type: BiquadFilterType, f: number, q: number, lfo?: [number, number]): Bed => {
      const s = ctx.createBufferSource();
      const fl = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      s.buffer = buffer;
      s.loop = true;
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      gain.gain.value = 0;
      s.connect(fl);
      fl.connect(gain);
      gain.connect(pan);
      pan.connect(master);
      pan.connect(reverb);
      s.start();
      if (lfo) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = lfo[0];
        g.gain.value = lfo[1];
        o.connect(g);
        g.connect(fl.frequency);
        o.start();
      }
      return { gain, pan };
    };

    const beds: Record<Voice, Bed> = {
      0: bed(white, "bandpass", 700, 1.3, [0.09, 260]), // aire suave
      1: bed(brown, "lowpass", 650, 0.4, [0.14, 340]), // olas lentas
      2: bed(brown, "lowpass", 130, 0.7), // retumbo
      3: bed(white, "bandpass", 7200, 7, [0.3, 900]), // cristal
    };
    const voces = ctx.createGain();
    voces.connect(master);
    voces.connect(reverb);
    return { ctx, master, puerta, reverb, white, beds, voces };
  }

  /** Suena el paso `j` en el instante `t`: camas según lo que hay bajo la flecha y detalles por celda. */
  private soundStep(j: number, t: number) {
    const a = this.audio;
    const grid = this.grid;
    if (!a || !grid) return;
    const pan = Math.sin((2 * Math.PI * j) / grid.steps) * 0.75;
    const count: Record<Voice, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const reach = Math.min(this.reach, grid.rings);
    for (let i = 0; i < reach; i++) {
      const cell = grid.cells[i]![j]!;
      if (cell.band == null || this.muted.has(cell.band)) continue;
      const voice = this.voiceOf(cell.band);
      count[voice]++;
      this.detail(voice, cell.value, i, j, t, pan);
    }
    for (const k of VOICE_LIST) {
      a.beds[k].gain.gain.setTargetAtTime((NIVEL[k] * count[k]) / reach, t, 0.14);
      a.beds[k].pan.pan.setTargetAtTime(pan, t, 0.2);
    }
  }

  private voiceOf(band: number): Voice {
    return Math.max(0, Math.min(3, this.bands[band]?.voice ?? band)) as Voice;
  }

  private detail(voice: Voice, value: number | null, capa: number, j: number, t: number, pan: number) {
    const grid = this.grid!;
    if (Math.random() > 6 / Math.max(6, grid.rings)) return;
    const i = Math.round((capa * 5) / Math.max(1, grid.rings - 1));
    const cada = (n: number) => Math.max(1, Math.round((n * grid.steps) / 48));
    // Altura según el valor del dato en la celda (pentatónica): más dato, más agudo.
    const step = Math.round(Math.max(0, Math.min(1, value ?? 0.5)) * 9);
    const byValue = (base: number) => base + 12 * Math.floor(step / 5) + ESCALA[step % 5]!;
    if (voice === 3 && (j + i * 5) % cada(8) === 0) {
      // Cristal: campanitas.
      const f = hz(byValue(74));
      this.tone({ t, f, dur: 1.3, g: 0.07, pan });
      this.tone({ t, f: f * 2.76, dur: 0.5, g: 0.02, pan });
    }
    if (voice === 2 && (j + i) % cada(3) === 0) this.grain({ t: t + Math.random() * 0.1, dur: 0.05, g: 0.1, pan, f: 500 + Math.random() * 900 });
    if (voice === 1 && (j + i * 3) % cada(12) === 0) this.grain({ t, dur: 1.5, g: 0.07, pan, f: 900, q: 0.7 });
    if (voice === 0 && (j + i * 4) % cada(12) === 0) {
      // Aire suave: acorde lento.
      const f = hz(byValue(55));
      this.tone({ t, f, dur: 2.4, g: 0.035, pan, attack: 0.8 });
      this.tone({ t, f: f * 1.5, dur: 2.4, g: 0.02, pan, attack: 0.9 });
    }
  }

  private out(pan: number): StereoPannerNode {
    const a = this.audio!;
    const p = a.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(a.voces);
    return p;
  }

  private tone({ t, f, dur, g, pan = 0, attack = 0.01 }: { t: number; f: number; dur: number; g: number; pan?: number; attack?: number }) {
    const a = this.audio!;
    const o = a.ctx.createOscillator();
    const env = a.ctx.createGain();
    o.frequency.setValueAtTime(f, t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(g, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this.out(pan);
    o.connect(env);
    env.connect(p);
    o.start(t);
    o.stop(t + dur + 0.05);
    o.onended = () => p.disconnect();
  }

  private grain({ t, dur, g, pan, f, q = 1.2 }: { t: number; dur: number; g: number; pan: number; f: number; q?: number }) {
    const a = this.audio!;
    const s = a.ctx.createBufferSource();
    const b = a.ctx.createBiquadFilter();
    const env = a.ctx.createGain();
    s.buffer = a.white;
    b.type = "bandpass";
    b.frequency.value = f;
    b.Q.value = q;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(g, t + Math.min(0.012, dur / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this.out(pan);
    s.connect(b);
    b.connect(env);
    env.connect(p);
    s.start(t, Math.random() * 3);
    s.stop(t + dur + 0.03);
    s.onended = () => p.disconnect();
  }

  /** Borra lo programado: notas en cola y cambios de volumen futuros. */
  private cut() {
    const a = this.audio;
    if (!a) return;
    const now = a.ctx.currentTime;
    for (const k of VOICE_LIST) {
      const g = a.beds[k].gain.gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(0, now, 0.02);
      a.beds[k].pan.pan.cancelScheduledValues(now);
    }
    const old = a.voces;
    old.gain.setTargetAtTime(0, now, 0.015);
    window.setTimeout(() => old.disconnect(), 150);
    a.voces = a.ctx.createGain();
    a.voces.connect(a.master);
    a.voces.connect(a.reverb);
  }

  private open() {
    const a = this.audio;
    if (!a) return;
    a.puerta.gain.cancelScheduledValues(a.ctx.currentTime);
    a.puerta.gain.setTargetAtTime(1, a.ctx.currentTime, 0.015);
  }

  private silence() {
    const a = this.audio;
    if (!a) return;
    this.cut();
    a.puerta.gain.cancelScheduledValues(a.ctx.currentTime);
    a.puerta.gain.setTargetAtTime(0, a.ctx.currentTime, 0.02);
  }

  // ---- Dibujo ----

  draw() {
    const c = this.canvas;
    const grid = this.grid;
    const pos = this.position();
    this.events.onPosition?.(pos);
    if (!c) return;
    const b = c.getContext("2d");
    if (!b) return;
    const S = c.width;
    const X = S / 2;
    const Y = S / 2;
    b.clearRect(0, 0, S, S);
    b.beginPath();
    b.arc(X, Y, S * 0.497, 0, 7);
    b.fillStyle = "#07050d";
    b.fill();
    b.lineWidth = 1;
    for (let k = 12; k < 49; k += 3) {
      b.beginPath();
      b.arc(X, Y, (S * k) / 100, 0, 7);
      b.strokeStyle = k % 2 ? "#1a1430" : "#141024";
      b.stroke();
    }
    if (!grid) return;

    const { rings, steps } = grid;
    const RR = S * 0.43;
    const core = RR * 0.1;
    this.discRadius = RR;
    this.core = core;
    const live = this.playing || !!this.drag;
    const current = Math.floor(pos);
    const trail = Math.max(1, Math.round(steps / 7));
    const textured = steps <= 64 && rings <= 9;
    const radiusOf = (i: number) => core + ((RR - core) * i) / rings;

    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < steps; j++) {
        const cell = grid.cells[i]![j]!;
        if (cell.band == null) continue;
        const band = this.bands[cell.band];
        const on = !this.muted.has(cell.band) && i < this.reach;
        const near = live ? (current - j + steps) % steps : 99;
        sector(b, X, Y, radiusOf(i) + 1.5, radiusOf(i + 1) - 1.5, j, steps);
        b.globalAlpha = !on ? 0.12 : near < trail ? 1 : 0.68;
        b.fillStyle = band?.color ?? "#888";
        b.fill();
        b.globalAlpha = on ? 1 : 0.2;
        if (textured) {
          const am = stepAngle(j + 0.5, steps);
          const rm = (radiusOf(i) + radiusOf(i + 1)) / 2;
          texture(b, this.voiceOf(cell.band), X + rm * Math.cos(am), Y + rm * Math.sin(am), Math.min(17, (radiusOf(i + 1) - radiusOf(i)) * 0.36), am, i, j);
        }
        b.globalAlpha = 1;
      }
    }

    const ang = (2 * Math.PI * pos) / steps - Math.PI / 2;
    if (live && b.createConicGradient) {
      const g = b.createConicGradient(ang - 0.9, X, Y);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.143, "rgba(255,255,255,.3)");
      g.addColorStop(0.1431, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      b.beginPath();
      b.arc(X, Y, RR, 0, 7);
      b.fillStyle = g;
      b.fill();
    }
    // Puntos del borde: el nivel predominante de cada paso.
    for (let j = 0; j < steps; j += Math.max(1, Math.round(steps / 48))) {
      const t = stepAngle(j + 0.5, steps);
      const band = grid.dominant[j];
      const far = live ? (current - j + steps) % steps : 99;
      b.beginPath();
      b.arc(X + S * 0.482 * Math.cos(t), Y + S * 0.482 * Math.sin(t), far < trail ? 8 : 5, 0, 7);
      b.fillStyle = band == null ? "#2b2440" : (this.bands[band]?.color ?? "#888");
      b.globalAlpha = far < trail ? 1 : 0.5;
      b.fill();
      b.globalAlpha = 1;
    }
    // Flecha: su largo es el alcance (cuántos anillos suenan).
    const grow = 0.65 + (0.75 * this.reach) / rings;
    const len = radiusOf(this.reach) + 16;
    const px = X + len * Math.cos(ang);
    const py = Y + len * Math.sin(ang);
    this.tipX = px;
    this.tipY = py;
    b.beginPath();
    b.moveTo(X, Y);
    b.lineTo(px, py);
    b.lineWidth = 7 * grow;
    b.strokeStyle = "#fff";
    b.stroke();
    b.beginPath();
    b.moveTo(px + 34 * grow * Math.cos(ang), py + 34 * grow * Math.sin(ang));
    b.lineTo(px + 24 * grow * Math.cos(ang + 1.75), py + 24 * grow * Math.sin(ang + 1.75));
    b.lineTo(px + 24 * grow * Math.cos(ang - 1.75), py + 24 * grow * Math.sin(ang - 1.75));
    b.closePath();
    b.fillStyle = this.drag?.tip ? "#29e7ff" : this.drag ? "#ffc23d" : "#fff";
    b.fill();
    b.beginPath();
    b.arc(X, Y, 13, 0, 7);
    b.fillStyle = "#fff";
    b.fill();
  }
}

function sector(g: CanvasRenderingContext2D, X: number, Y: number, r0: number, r1: number, j: number, steps: number) {
  const pts = 4;
  g.beginPath();
  for (let k = 0; k <= pts; k++) {
    const a = stepAngle(j + k / pts, steps);
    g[k ? "lineTo" : "moveTo"](X + r1 * Math.cos(a), Y + r1 * Math.sin(a));
  }
  for (let k = pts; k >= 0; k--) {
    const a = stepAngle(j + k / pts, steps);
    g.lineTo(X + r0 * Math.cos(a), Y + r0 * Math.sin(a));
  }
  g.closePath();
}

function texture(g: CanvasRenderingContext2D, voice: Voice, x: number, y: number, q: number, ang: number, i: number, j: number) {
  g.strokeStyle = g.fillStyle = "rgba(6,10,20,.62)";
  g.lineWidth = 2.2;
  g.lineCap = "round";
  if (voice === 2) {
    // Grava: puntos.
    for (let k = 0; k < 3; k++) {
      const a = (((i * 7 + j * 3 + k * 5) % 11) / 11) * 6.28;
      g.beginPath();
      g.arc(x + q * 0.55 * Math.cos(a), y + q * 0.55 * Math.sin(a), 2.4, 0, 7);
      g.fill();
    }
  }
  if (voice === 1) {
    // Olas: una onda.
    g.beginPath();
    for (let k = -1; k <= 1; k += 0.25) {
      const u = k * q * 0.9;
      const v = Math.sin(k * 5) * q * 0.22;
      const xx = x + u * Math.cos(ang + 1.57) + v * Math.cos(ang);
      const yy = y + u * Math.sin(ang + 1.57) + v * Math.sin(ang);
      g[k === -1 ? "moveTo" : "lineTo"](xx, yy);
    }
    g.stroke();
  }
  if (voice === 3) {
    // Cristal: copo.
    g.strokeStyle = "rgba(40,90,140,.75)";
    for (let k = 0; k < 3; k++) {
      const a = ang + k * 1.047;
      g.beginPath();
      g.moveTo(x - q * 0.62 * Math.cos(a), y - q * 0.62 * Math.sin(a));
      g.lineTo(x + q * 0.62 * Math.cos(a), y + q * 0.62 * Math.sin(a));
      g.stroke();
    }
  }
  if (voice === 0) {
    // Aire: nubecitas.
    g.fillStyle = "rgba(255,255,255,.5)";
    for (const [u, v, r] of [[-0.42, 0.08, 0.34], [0, -0.14, 0.44], [0.42, 0.08, 0.34]] as const) {
      const xx = x + q * (u * Math.cos(ang + 1.57) + v * Math.cos(ang));
      const yy = y + q * (u * Math.sin(ang + 1.57) + v * Math.sin(ang));
      g.beginPath();
      g.arc(xx, yy, q * r, 0, 7);
      g.fill();
    }
  }
}
