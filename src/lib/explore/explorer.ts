/**
 * Motor del radar: sonido (Web Audio) y reloj de la vuelta de la flecha. Viene de
 * "Capas de la Tierra" (`index.html`); el dibujo lo hace el reproductor sobre el mapa.
 *
 * No depende de React: el componente le pasa la cuadrícula y recibe la posición de la flecha.
 */
import type { DiscGrid } from "@/lib/explore/disc";
import type { DataBand } from "@/lib/player";
import { paletteFor, type Palette } from "@/lib/sound/palettes";
import { loadInstrument, playSample, type Instrument, type InstrumentId } from "@/lib/sound/samples";
import { noteFor } from "@/lib/sound/sonifier";

/** Nivel del dato de 0 (el más calmado) a 3 (el más intenso). */
type Voice = 0 | 1 | 2 | 3;

/** Segundos que tarda la flecha en dar una vuelta completa. */
const TURN_SECONDS = 12;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Cuánto tiene que cambiar el dato bajo la flecha (0–1) para que suene una nota nueva. */
const CHANGE = 0.12;
/** Semitonos que sube o baja el sonido continuo entre la dirección más baja y la más alta. */
const PAD_RANGE = 7;

/** Sonido continuo del radar: un acorde suave que se desliza (osciladores, filtro y volumen). */
interface Pad {
  oscs: OscillatorNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
  pan: StereoPannerNode;
}

interface Audio {
  ctx: AudioContext;
  master: GainNode;
  puerta: GainNode;
  reverb: ConvolverNode;
  voces: GainNode;
  pad: Pad;
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
  private reach = 6;
  private volume = 75;
  private bands: DataBand[] = [];
  /** Sonidos del dataset: con qué instrumento suena cada paso (`palettes.ts`). */
  private palette: Palette = paletteFor(null);
  private inst = new Map<InstrumentId, Instrument>();
  /** Dato y nivel de la última nota pellizcada: solo suena otra cuando algo cambia de verdad. */
  private lastNote: { mean: number; top: number } | null = null;
  /**
   * Media del dato en cada dirección del radar y media de todo el círculo (con su
   * dispersión): el sonido continuo sube donde la dirección está por encima del resto.
   */
  private stats: { means: (number | null)[]; avg: number; spread: number } | null = null;

  private playing = false;
  private inicio = 0;
  private paso = 0;
  private durPaso = 0.25;
  private posPausa = 0;
  private reloj = 0;
  private raf = 0;
  private duckTimer = 0;

  private events: ExplorerEvents = {};

  /** Callbacks hacia la interfaz. */
  on(events: ExplorerEvents) {
    this.events = events;
  }

  // ---- Configuración ----

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
    this.stats = grid ? directionStats(grid) : null;
    if (!this.playing) this.emit();
  }

  getReach() {
    return this.reach;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.audio) this.audio.master.gain.value = (volume / 100) * 1.6;
  }

  /** Paleta del dataset (perfil del motor): con qué instrumento suena el radar. */
  setPalette(profileId: string | null) {
    const next = paletteFor(profileId);
    if (next === this.palette) return;
    this.palette = next;
    this.inst.clear();
    if (this.audio) this.loadSamples(this.audio.ctx);
  }

  private loadSamples(ctx: AudioContext) {
    for (const id of new Set([this.palette.radar, this.palette.accent])) {
      void loadInstrument(ctx, id).then((inst) => {
        if (inst && this.audio?.ctx === ctx) this.inst.set(id, inst);
      });
    }
  }

  setBands(bands: DataBand[]) {
    this.bands = bands;
    if (!this.playing) this.emit();
  }

  isPlaying() {
    return this.playing;
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
      this.emit();
      return;
    }
    if (!(await this.ensureAudio())) return;
    this.startClock(this.posPausa);
  }

  pause() {
    if (!this.playing) return;
    this.stopClock();
    this.silence();
    this.emit();
  }

  dispose() {
    this.stopClock();
    window.clearInterval(this.duckTimer);
    const a = this.audio;
    this.audio = null;
    this.inst.clear();
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
    this.durPaso = TURN_SECONDS / steps;
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
    this.emit();
    if (this.playing) this.raf = requestAnimationFrame(this.loop);
  };

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

    const voces = ctx.createGain();
    voces.connect(master);
    voces.connect(reverb);

    // Sonido continuo: triángulo y seno un poco desafinados entre sí, más un seno una
    // octava abajo; un filtro suave lo aclara u oscurece según el dato.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(master);
    pan.connect(reverb);
    const oscs = ([["triangle", -7, 0.5], ["sine", 7, 0.5], ["sine", -1200, 0.35]] as const).map(([type, detune, level]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = 220;
      o.detune.value = detune;
      g.gain.value = level;
      o.connect(g);
      g.connect(filter);
      o.start();
      return o;
    });

    // `this.audio` apunta a este grafo cuando corre la microtarea.
    queueMicrotask(() => this.loadSamples(ctx));
    return { ctx, master, puerta, reverb, voces, pad: { oscs, filter, gain, pan } };
  }

  /** Suena el paso `j` en el instante `t` con el instrumento del dataset. */
  private soundStep(j: number, t: number) {
    const grid = this.grid;
    if (!this.audio || !grid) return;
    const pan = Math.sin((2 * Math.PI * j) / grid.steps) * 0.75;
    this.musicStep(j, t, pan, Math.min(this.reach, grid.rings));
  }

  /**
   * Paso del radar, con dos capas:
   * - Sonido continuo (`pad`): suena mientras haya dato bajo la flecha. Su tono sube
   *   cuando la media de esa dirección está por encima de la media de todo el radar y
   *   baja cuando está por debajo; su brillo y volumen siguen al dato y al nivel.
   * - Nota del instrumento del dataset: solo cuando lo que hay bajo la flecha cambia
   *   de verdad (otro nivel o un salto en el dato). Una zona pareja se oye como el
   *   sonido continuo, sin golpes repetidos. En el nivel más intenso, además, el golpe
   *   del dataset (campana, timbal…).
   */
  private musicStep(j: number, t: number, pan: number, reach: number) {
    const a = this.audio!;
    const grid = this.grid!;
    let top = -1;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < reach; i++) {
      const cell = grid.cells[i]![j]!;
      if (cell.band == null) continue;
      top = Math.max(top, this.voiceOf(cell.band));
      if (cell.value != null) {
        sum += cell.value;
        n++;
      }
    }
    const pad = a.pad;
    if (top < 0) {
      // Sin dato bajo la flecha: silencio.
      this.lastNote = null;
      pad.gain.gain.setTargetAtTime(0, t, 0.12);
      return;
    }
    const mean = n ? sum / n : top / 3;

    const st = this.stats;
    const rel = st ? clamp((mean - st.avg) / (2 * st.spread), -1, 1) : 0;
    const center = noteFor(st?.avg ?? mean) + this.palette.radarShift - 12;
    const f = hz(center + rel * PAD_RANGE);
    for (const o of pad.oscs) o.frequency.setTargetAtTime(f, t, 0.12);
    pad.filter.frequency.setTargetAtTime(450 + 1600 * clamp(mean, 0, 1), t, 0.2);
    pad.gain.gain.setTargetAtTime(0.035 + 0.025 * top, t, 0.2);
    pad.pan.pan.setTargetAtTime(pan, t, 0.2);

    const last = this.lastNote;
    if (last && last.top === top && Math.abs(mean - last.mean) < CHANGE) return;
    this.lastNote = { mean, top };
    const midi = noteFor(mean) + this.palette.radarShift;
    const dur = Math.max(1.2, this.durPaso * 6);
    const gain = 0.06 + 0.06 * top;
    const inst = this.inst.get(this.palette.radar);
    if (!inst || !playSample(inst, { t, dest: a.voces, midi, gain, pan, dur })) this.tone({ t, f: hz(midi), dur, g: gain * 0.5, pan });
    const accent = this.inst.get(this.palette.accent);
    if (top === 3 && accent && j % 2 === 0) playSample(accent, { t, dest: a.voces, midi: midi + 12, gain: 0.08, pan, dur: 1.2 });
  }

  private voiceOf(band: number): Voice {
    return Math.max(0, Math.min(3, this.bands[band]?.voice ?? band)) as Voice;
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

  /** Borra lo programado: notas en cola y cambios de volumen futuros. */
  private cut() {
    const a = this.audio;
    if (!a) return;
    const now = a.ctx.currentTime;
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
    this.lastNote = null;
    a.pad.gain.gain.cancelScheduledValues(a.ctx.currentTime);
    a.pad.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
    a.puerta.gain.cancelScheduledValues(a.ctx.currentTime);
    a.puerta.gain.setTargetAtTime(0, a.ctx.currentTime, 0.02);
  }

  // ---- Posición ----

  /** Avisa a la interfaz dónde está la flecha (el reproductor la dibuja sobre el mapa). */
  private emit() {
    this.events.onPosition?.(this.position());
  }
}

/** Media del dato en cada dirección (todos los anillos) y media y dispersión de esas medias. */
function directionStats(grid: DiscGrid): { means: (number | null)[]; avg: number; spread: number } | null {
  const means = Array.from({ length: grid.steps }, (_, j) => {
    let sum = 0;
    let n = 0;
    for (const row of grid.cells) {
      const v = row[j]?.value;
      if (v != null) {
        sum += v;
        n++;
      }
    }
    return n ? sum / n : null;
  });
  const known = means.filter((m): m is number => m != null);
  if (known.length === 0) return null;
  const avg = known.reduce((x, y) => x + y, 0) / known.length;
  const sd = Math.sqrt(known.reduce((x, y) => x + (y - avg) ** 2, 0) / known.length);
  // Con una zona casi pareja, una diferencia pequeña igual se oye (pero sin exagerarla).
  return { means, avg, spread: Math.max(sd, 0.03) };
}
