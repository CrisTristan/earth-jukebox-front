/**
 * Sonificación de una track con Web Audio.
 *
 * Mezcla dos capas, como en el prototipo "Capas de la Tierra" (`index.html`):
 * - Naturaleza: camas de ruido filtrado que suenan a tierra (retumbo), agua (olas),
 *   aire (viento suave) y hielo (cristal), más detalles sueltos encima: grava o
 *   chisporroteo, gotas de lluvia, hojas y campanitas de cristal.
 * - Música: una melodía en escala pentatónica cuya nota sigue el dato del frame.
 *
 * Qué controla cada dato (todo sale de `engine_metadata.hints` de la API):
 * - `melody` (feature + rango de valores) → altura de la nota: más valor, más aguda.
 * - `intensity` → volumen de las camas y densidad de la textura (`texture`).
 * - `secondary` → campanitas de cristal y brillo del hielo.
 * - `brightness` → brillo del timbre de la melodía (filtro).
 * - Reparto del dato entre regiones de tierra y de océano → retumbo frente a olas.
 * - `centroid_lon` → posición estéreo: el sonido se oye hacia donde está el dato.
 *
 * Con qué suena cada dataset lo decide su paleta (`palettes.ts`): la melodía se toca
 * con muestras de instrumentos reales (VCSL, `samples.ts`) y, salvo en los datasets de
 * naturaleza, las camas de ruido se cambian por una textura musical. Mientras las
 * muestras cargan (o si fallan) suenan los osciladores y el ruido de siempre.
 */
import { paletteFor, paletteInstruments, type Palette } from "@/lib/sound/palettes";
import { loadInstrument, playSample, type Instrument, type InstrumentId } from "@/lib/sound/samples";

export const LAYER_MODES = ["Nature + music", "Nature only", "Music only"] as const;
export const PRESETS = ["Ambient", "Pulsing", "Orchestral", "Granular"] as const;
export type LayerMode = (typeof LAYER_MODES)[number];
export type Preset = (typeof PRESETS)[number];

/** Feature con el rango que se usa para normalizarla a 0–1. */
export interface ScaledFeature {
  feature: string;
  min: number;
  max: number;
}

/** Lo que el motor necesita de una track (serializable: viaja del servidor al cliente). */
export interface SoundProfile {
  /** Perfil del motor: elige la paleta de sonidos (`palettes.ts`). */
  profileId: string | null;
  melody: ScaledFeature | null;
  intensity: ScaledFeature | null;
  secondary: ScaledFeature | null;
  brightness: ScaledFeature | null;
  /** "heat" (chisporroteo), "rain" (lluvia y aire) o "leaves" (hojas). */
  texture: string | null;
  /** Rango de la cuadrícula, para el sonido del clic en el mapa. */
  valueRange: [number, number] | null;
}

/** Lo que el motor necesita de un frame. */
export interface SoundFrame {
  features: Record<string, number>;
  /** Parte del dato sobre tierra (0–1); el resto está sobre el océano. */
  land: number | null;
}

/** Escala pentatónica: suena bien con cualquier combinación de notas. */
const PENTA = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Valor de una feature en 0–1 según su rango (puede salirse un poco), o null si no está. */
export function normalized(scale: ScaledFeature | null, features: Record<string, number>): number | null {
  if (!scale) return null;
  const v = features[scale.feature];
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const span = scale.max - scale.min;
  return Math.abs(span) < 1e-12 ? 0.5 : (v - scale.min) / span;
}

/** 0–1 → nota MIDI pentatónica entre C4 (60) y C6 (84). */
export function noteFor(v: number): number {
  const step = clamp(Math.round(clamp(v, -0.1, 1.1) * 10), 0, 10);
  return 60 + 12 * Math.floor(step / 5) + PENTA[step % 5]!;
}

/** Volumen de cada cama de naturaleza (mismas proporciones que el prototipo). */
const NATURE = { tierra: 1.5, agua: 0.62, nube: 0.34, hielo: 0.1 } as const;
type Ground = keyof typeof NATURE;

/** Cómo suena la melodía con cada preset del menú. */
const PRESET_VOICE: Record<Preset, { every: number; dur: number; attack: number; wave: OscillatorType; gain: number; fifth: boolean; scatter: boolean }> = {
  Ambient: { every: 2, dur: 2.8, attack: 0.3, wave: "sine", gain: 0.16, fifth: false, scatter: false },
  Pulsing: { every: 0.5, dur: 0.32, attack: 0.008, wave: "triangle", gain: 0.12, fifth: false, scatter: false },
  Orchestral: { every: 4, dur: 4.4, attack: 0.9, wave: "sawtooth", gain: 0.05, fifth: true, scatter: false },
  Granular: { every: 0.11, dur: 0.08, attack: 0.004, wave: "sine", gain: 0.07, fifth: false, scatter: true },
};

/** Volumen de la melodía con muestras, por preset (las muestras llegan normalizadas a -3 dB). */
const SAMPLE_GAIN: Record<Preset, number> = { Ambient: 0.32, Pulsing: 0.24, Orchestral: 0.22, Granular: 0.12 };

/** Cada cuánto se reparten los detalles de naturaleza (s). */
const GRAIN_EVERY = 0.25;
/** Margen con que se programa el sonido por delante del reloj (s). */
const LOOKAHEAD = 0.2;

interface FrameState {
  midi: number;
  /** Valor de la melodía en 0–1 (0.5 = centro, en los datos con centro). */
  melodyValue: number;
  pan: number;
  bright: number;
  intensity: number;
  secondary: number;
  land: number;
}

interface Bed {
  gain: GainNode;
  pan: StereoPannerNode;
}

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  duck: GainNode;
  nature: GainNode;
  music: GainNode;
  reverb: ConvolverNode;
  melodyFilter: BiquadFilterNode;
  /**
   * Entradas de la melodía y de la textura. Al pausar se apagan y se cambian por
   * otras nuevas: así se cortan las notas que seguían sonando (un dron dura varios
   * segundos), sin tocar el sonido del clic en el mapa.
   */
  melodyIn: GainNode;
  textureIn: GainNode;
  white: AudioBuffer;
  beds: Record<Ground, Bed>;
}

export class Sonifier {
  private g: Graph | null = null;
  private timer = 0;
  private duckTimer = 0;
  private playing = false;
  private nextNote = 0;
  private nextGrain = 0;
  private volume = 70;
  private layers: LayerMode = "Nature + music";
  private preset: Preset = "Ambient";
  private state: FrameState = { midi: 67, melodyValue: 0.5, pan: 0, bright: 0.5, intensity: 0.4, secondary: 0, land: 0.5 };
  private readonly palette: Palette;
  /** Instrumentos ya cargados para el contexto actual. */
  private inst = new Map<InstrumentId, Instrument>();
  private nextDrone = 0;
  private nextShimmer = 0;

  constructor(private readonly profile: SoundProfile) {
    this.palette = paletteFor(profile.profileId);
  }

  /** Con naturaleza sintetizada (humedad, lluvia, temperatura, vegetación) o con textura musical. */
  private get natural() {
    return this.palette.texture.kind === "nature";
  }

  /** El audio está sonando (el navegador lo permitió). */
  get running(): boolean {
    return this.g?.ctx.state === "running";
  }

  /**
   * Crea (o reanuda) el audio y resuelve cuando ya suena. Dentro de un gesto de la
   * persona (clic, toque o tecla) siempre funciona: la parte síncrona crea y
   * reanuda el `AudioContext` ahí mismo. Fuera de un gesto queda pendiente hasta el siguiente.
   */
  start(): Promise<boolean> {
    try {
      this.g ??= this.build();
      return this.g.ctx.resume().then(() => true, () => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  /**
   * Intenta sonar sin esperar un gesto, al entrar en la track. El navegador lo
   * permite si la persona ya interactuó con el sitio (por ejemplo, al elegir la
   * track con un clic); si se abre la URL directamente, devuelve false.
   */
  async tryStart(): Promise<boolean> {
    try {
      this.g ??= this.build();
    } catch {
      return false;
    }
    const { ctx } = this.g;
    const isRunning = () => ctx.state === "running";
    if (isRunning()) return true;
    await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
    return isRunning();
  }

  setVolume(volume: number) {
    this.volume = volume;
    const g = this.g;
    if (g) g.master.gain.setTargetAtTime((volume / 100) * 1.4, g.ctx.currentTime, 0.05);
  }

  setLayers(mode: LayerMode) {
    this.layers = mode;
    const g = this.g;
    if (!g) return;
    const t = g.ctx.currentTime;
    g.nature.gain.setTargetAtTime(mode === "Music only" ? 0 : 1, t, 0.1);
    g.music.gain.setTargetAtTime(mode === "Nature only" ? 0 : 1, t, 0.1);
  }

  setPreset(preset: Preset) {
    this.preset = preset;
  }

  /** Frame que suena durante la reproducción: la primera nota coincide con el cambio de imagen. */
  play(frame: SoundFrame) {
    const g = this.g;
    if (!g) return;
    const t = g.ctx.currentTime;
    this.state = this.stateOf(frame);
    this.applyBeds(t);
    this.nextNote = t + 0.03;
    if (!this.playing) {
      this.playing = true;
      this.nextGrain = t + 0.03;
      this.nextDrone = this.nextShimmer = t + 0.03;
      this.timer = window.setInterval(() => this.schedule(), 50);
    }
  }

  /** Silencia las camas y deja de programar notas. */
  pause() {
    const g = this.g;
    this.playing = false;
    window.clearInterval(this.timer);
    if (!g) return;
    const t = g.ctx.currentTime;
    for (const bed of Object.values(g.beds)) {
      bed.gain.gain.cancelScheduledValues(t);
      bed.gain.gain.setTargetAtTime(0, t, 0.15);
    }
    this.cutTails(g);
  }

  /** Apaga en ~0.3 s lo que seguía sonando (notas, drones, granos) y deja entradas nuevas. */
  private cutTails(g: Graph) {
    const t = g.ctx.currentTime;
    for (const [key, to] of [["melodyIn", g.melodyFilter], ["textureIn", g.nature]] as const) {
      const old = g[key];
      old.gain.setTargetAtTime(0, t, 0.08);
      window.setTimeout(() => old.disconnect(), 600);
      const fresh = g.ctx.createGain();
      fresh.connect(to);
      g[key] = fresh;
    }
  }

  /** Un frame suelto, en pausa (al pasar frames con las flechas): una nota y un soplo de naturaleza. */
  preview(frame: SoundFrame) {
    const g = this.g;
    if (!g) return;
    const t = g.ctx.currentTime;
    this.state = this.stateOf(frame);
    this.applyBeds(t);
    for (const bed of Object.values(g.beds)) bed.gain.gain.setTargetAtTime(0, t + 1.2, 0.3);
    this.melodyNote(t + 0.02, PRESET_VOICE.Ambient);
    this.details(t + 0.02);
    this.details(t + 0.27);
  }

  /** Campanita del clic en el mapa: más aguda cuanto más alto es el valor en ese punto. */
  ping(value: number | null, pan: number) {
    const g = this.g;
    if (!g) return;
    const t = g.ctx.currentTime + 0.01;
    const range = this.profile.valueRange;
    if (value == null || !range) {
      // Sin dato en ese punto: un golpe sordo y grave.
      this.tone({ t, f: 110, dur: 0.25, g: 0.12, pan, bus: g.music });
      return;
    }
    const midi = noteFor((value - range[0]) / (range[1] - range[0] || 1));
    const radar = this.inst.get(this.palette.radar);
    if (radar && playSample(radar, { t, dest: g.music, midi: midi + this.palette.radarShift, gain: 0.32, pan, dur: 1.6 })) return;
    const f = hz(midi);
    this.tone({ t, f, dur: 0.9, g: 0.14, pan, bus: g.music });
    this.tone({ t, f: f * 2.76, dur: 0.4, g: 0.03, pan, bus: g.music });
  }

  /** Cierra el audio. La instancia se puede volver a arrancar con `start()`. */
  dispose() {
    this.playing = false;
    window.clearInterval(this.timer);
    window.clearInterval(this.duckTimer);
    const g = this.g;
    this.g = null;
    this.inst.clear();
    void g?.ctx.close().catch(() => {});
  }

  /** Carga los instrumentos de la paleta; cada uno se usa en cuanto está listo. */
  private loadSamples(ctx: AudioContext) {
    for (const id of paletteInstruments(this.palette)) {
      void loadInstrument(ctx, id).then((inst) => {
        if (inst && this.g?.ctx === ctx) this.inst.set(id, inst);
      });
    }
  }

  // ---- Interno ----

  private stateOf(frame: SoundFrame): FrameState {
    const { features } = frame;
    const p = this.profile;
    const lon = features.centroid_lon;
    const melody = normalized(p.melody, features) ?? 0.5;
    return {
      midi: noteFor(melody),
      melodyValue: clamp01(melody),
      intensity: clamp01(normalized(p.intensity, features) ?? 0.4),
      secondary: clamp01(normalized(p.secondary, features) ?? 0),
      bright: clamp01(normalized(p.brightness, features) ?? 0.5),
      pan: typeof lon === "number" && Number.isFinite(lon) ? clamp(lon / 180, -1, 1) * 0.7 : 0,
      land: clamp01(frame.land ?? 0.5),
    };
  }

  private build(): Graph {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();

    // master → compresor → salida; todo pasa antes por `duck`, que baja cuando habla la voz guía.
    const master = ctx.createGain();
    master.gain.value = (this.volume / 100) * 1.4;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    const duck = ctx.createGain();
    duck.connect(master);

    // Reverberación con una respuesta de ruido que decae (como en el prototipo).
    const irLength = ctx.sampleRate * 2;
    const ir = ctx.createBuffer(2, irLength, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < irLength; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 2.6);
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    reverb.connect(wet);
    wet.connect(duck);

    const nature = ctx.createGain();
    const music = ctx.createGain();
    for (const bus of [nature, music]) {
      bus.connect(duck);
      bus.connect(reverb);
    }
    nature.gain.value = this.layers === "Music only" ? 0 : 1;
    music.gain.value = this.layers === "Nature only" ? 0 : 1;

    const melodyFilter = ctx.createBiquadFilter();
    melodyFilter.type = "lowpass";
    melodyFilter.frequency.value = 3000;
    melodyFilter.connect(music);

    // Ruido blanco y ruido "marrón" (más grave), en bucle.
    const length = ctx.sampleRate * 4;
    const white = ctx.createBuffer(1, length, ctx.sampleRate);
    const brown = ctx.createBuffer(1, length, ctx.sampleRate);
    const w = white.getChannelData(0);
    const b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]!) / 1.02;
      b[i] = last * 3.5;
    }

    const bed = (buffer: AudioBuffer, type: BiquadFilterType, f: number, q: number, lfo?: [number, number]): Bed => {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      src.buffer = buffer;
      src.loop = true;
      filter.type = type;
      filter.frequency.value = f;
      filter.Q.value = q;
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(nature);
      src.start();
      if (lfo) {
        const osc = ctx.createOscillator();
        const depth = ctx.createGain();
        osc.frequency.value = lfo[0];
        depth.gain.value = lfo[1];
        osc.connect(depth);
        depth.connect(filter.frequency);
        osc.start();
      }
      return { gain, pan };
    };

    const beds: Record<Ground, Bed> = {
      tierra: bed(brown, "lowpass", 130, 0.7), // retumbo de tierra
      agua: bed(brown, "lowpass", 650, 0.4, [0.14, 340]), // olas lentas
      nube: bed(white, "bandpass", 700, 1.3, [0.09, 260]), // aire suave
      hielo: bed(white, "bandpass", 7200, 7, [0.3, 900]), // cristal
    };

    // Baja la mezcla mientras habla la voz guía o la del mapa.
    this.duckTimer = window.setInterval(() => {
      const speaking = typeof speechSynthesis !== "undefined" && speechSynthesis.speaking;
      duck.gain.setTargetAtTime(speaking ? 0.3 : 1, ctx.currentTime, 0.08);
    }, 150);

    const melodyIn = ctx.createGain();
    melodyIn.connect(melodyFilter);
    const textureIn = ctx.createGain();
    textureIn.connect(nature);
    const graph = { ctx, master, duck, nature, music, reverb, melodyFilter, melodyIn, textureIn, white, beds };
    // `this.g` todavía no apunta a este grafo: se compara cuando terminan de cargar.
    queueMicrotask(() => this.loadSamples(ctx));
    return graph;
  }

  /** Volumen y posición de las camas según el frame. */
  private applyBeds(t: number) {
    const g = this.g;
    if (!g) return;
    const s = this.state;
    const level = 0.35 + 0.65 * s.intensity;
    const rain = this.profile.texture === "rain";
    // Fuera de los datasets de naturaleza, la textura musical (`texture`) reemplaza a las camas.
    const on = this.natural ? 1 : 0;
    const target: Record<Ground, number> = {
      tierra: on * NATURE.tierra * s.land * level * 0.6,
      agua: on * NATURE.agua * (1 - s.land) * level,
      nube: on * NATURE.nube * (rain ? 0.4 + 0.8 * s.intensity : 0.35),
      hielo: on * NATURE.hielo * (0.3 + 1.5 * s.secondary),
    };
    for (const k of Object.keys(target) as Ground[]) {
      const bed = g.beds[k];
      bed.gain.gain.cancelScheduledValues(t);
      bed.gain.gain.setTargetAtTime(target[k], t, 0.4);
      bed.pan.pan.setTargetAtTime(s.pan * 0.5, t, 0.4);
    }
    g.melodyFilter.frequency.setTargetAtTime(700 + s.bright * 5000, t, 0.3);
  }

  private schedule() {
    const g = this.g;
    if (!g || !this.playing) return;
    const horizon = g.ctx.currentTime + LOOKAHEAD;
    const voice = PRESET_VOICE[this.preset];
    // Si la pestaña estuvo en segundo plano, no se recupera todo lo atrasado de golpe.
    if (this.nextNote < g.ctx.currentTime - 1) this.nextNote = g.ctx.currentTime;
    if (this.nextGrain < g.ctx.currentTime - 1) this.nextGrain = g.ctx.currentTime;
    while (this.nextNote < horizon) {
      this.melodyNote(this.nextNote, voice);
      this.nextNote += voice.every;
    }
    while (this.nextGrain < horizon) {
      this.details(this.nextGrain);
      this.nextGrain += GRAIN_EVERY;
    }
  }

  private melodyNote(t: number, voice: (typeof PRESET_VOICE)[Preset]) {
    const g = this.g;
    if (!g) return;
    const s = this.state;
    let midi = s.midi;
    let pan = s.pan;
    if (voice.scatter) {
      // Granular: la misma nota con algunos granos una octava arriba, repartidos en el estéreo.
      if (Math.random() < 0.25) midi += 12;
      pan = clamp(pan + (Math.random() - 0.5) * 0.6, -1, 1);
    }
    // Con muestras: el instrumento de la paleta (en los datos con centro, otro por encima del centro).
    const warm = this.palette.warm && s.melodyValue > 0.5 ? this.palette.warm : null;
    const inst = this.inst.get(warm ? warm.inst : this.palette.melody);
    if (inst) {
      const note = midi + (warm ? warm.shift : this.palette.shift);
      const gain = SAMPLE_GAIN[this.preset];
      const dur = Math.max(voice.dur, 0.12);
      playSample(inst, { t, dest: g.melodyIn, midi: note, gain, pan, dur });
      if (voice.fifth) playSample(inst, { t, dest: g.melodyIn, midi: note + 7, gain: gain * 0.6, pan, dur });
      return;
    }
    const f = hz(midi);
    const common = { t, dur: voice.dur, pan, wave: voice.wave, attack: voice.attack, bus: g.melodyIn };
    this.tone({ ...common, f, g: voice.gain });
    if (voice.fifth) this.tone({ ...common, f: f * 1.5, g: voice.gain * 0.6 });
    else if (voice.wave === "sine") this.tone({ ...common, f: f * 2, g: voice.gain * 0.15 });
  }

  /** Detalles de naturaleza en un intervalo de `GRAIN_EVERY` segundos. */
  private details(t: number) {
    const g = this.g;
    if (!g) return;
    const s = this.state;
    const r = Math.random;
    const spread = () => clamp(s.pan + (r() - 0.5) * 1.2, -1, 1);
    const bus = g.textureIn;

    if (!this.natural) {
      this.texture(t);
      this.accent(t, spread());
      return;
    }

    switch (this.profile.texture) {
      case "rain": {
        // Gotas: más cuanto más intenso es el dato.
        const drops = Math.round(s.intensity * 5 + r());
        for (let k = 0; k < drops; k++) {
          this.grain({ t: t + r() * GRAIN_EVERY, dur: 0.015 + r() * 0.02, g: 0.05 + 0.05 * r(), f: 2500 + r() * 3500, q: 1.5, pan: spread(), bus });
        }
        // De vez en cuando, un acorde suave de nube.
        if (r() < 0.05) {
          const f = hz(62 + PENTA[Math.floor(r() * 5)]!);
          this.tone({ t, f, dur: 2.4, g: 0.035, pan: spread(), attack: 0.8, bus });
          this.tone({ t, f: f * 1.5, dur: 2.4, g: 0.02, pan: spread(), attack: 0.9, bus });
        }
        break;
      }
      case "leaves": {
        // Hojas que se agitan.
        if (r() < 0.2 + 0.6 * s.intensity) {
          this.grain({ t: t + r() * GRAIN_EVERY, dur: 0.12 + r() * 0.1, g: 0.05, f: 3000 + r() * 3000, q: 0.8, pan: spread(), bus });
        }
        break;
      }
      default: {
        // "heat" y el resto: grava / chisporroteo.
        const crackles = r() < 0.3 + 0.7 * s.intensity ? 1 + Math.round(s.intensity * 2) : 0;
        for (let k = 0; k < crackles; k++) {
          this.grain({ t: t + r() * GRAIN_EVERY, dur: 0.05, g: 0.1, f: 500 + r() * 900, q: 1.2, pan: spread(), bus });
        }
      }
    }

    // Olas que rompen cuando el dato está sobre todo en el océano.
    if (1 - s.land > 0.4 && r() < 0.08) this.grain({ t, dur: 1.5, g: 0.07, f: 900, q: 0.7, pan: spread(), bus });

    // Campanitas de cristal: el dato secundario (frío extremo, nieve, aire contaminado…).
    if (r() < s.secondary * 0.15) {
      const midi = 86 - 5 * Math.floor(r() * 3) + PENTA[Math.floor(r() * 5)]!;
      const pan = spread();
      const bells = this.inst.get(this.palette.accent);
      if (!bells || !playSample(bells, { t, dest: bus, midi, gain: 0.12, pan, dur: 1.6 })) {
        const f = hz(midi);
        this.tone({ t, f, dur: 1.3, g: 0.07, pan, bus });
        this.tone({ t, f: f * 2.76, dur: 0.5, g: 0.02, pan, bus });
      }
    }
  }

  /**
   * Textura musical de los datasets que no son de naturaleza, en el intervalo de
   * `GRAIN_EVERY` que empieza en `t`. Crece con la intensidad del dato.
   */
  private texture(t: number) {
    const g = this.g;
    const tex = this.palette.texture;
    if (!g || !("inst" in tex)) return;
    const inst = this.inst.get(tex.inst);
    if (!inst) return;
    const s = this.state;
    const r = Math.random;
    const I = s.intensity;
    const bus = g.textureIn;
    const spread = () => clamp(s.pan + (r() - 0.5) * 1.2, -1, 1);
    const base = s.midi + this.palette.shift;

    switch (tex.kind) {
      case "drone": {
        // Nota larga que se repite; con acorde, más voces cuanto más intenso.
        if (t < this.nextDrone) return;
        this.nextDrone = t + tex.every;
        const dur = tex.every + 1.5;
        const gain = 0.08 + 0.3 * I;
        const root = tex.shift == null ? undefined : s.midi + tex.shift;
        // Sin el golpe inicial de la muestra y con fundido: cada repetición se encadena
        // con la anterior (se solapan 1.5 s) y no se oye un "pum" cada vez.
        const smooth = { offset: 0.6, fadeIn: 1.2 };
        playSample(inst, { t, dest: bus, midi: root, gain, pan: s.pan * 0.5, dur, ...smooth });
        if (tex.chord && root != null && I > 0.35) playSample(inst, { t, dest: bus, midi: root + 7, gain: gain * 0.7, pan: -s.pan * 0.3, dur, ...smooth });
        if (tex.chord && root != null && I > 0.7) playSample(inst, { t, dest: bus, midi: root + 12, gain: gain * 0.6, pan: s.pan * 0.3, dur, ...smooth });
        break;
      }
      case "pulse":
        // Golpes en la rejilla: con poca contaminación, pocos; con mucha, casi todos.
        if (r() < 0.12 + 0.8 * I) playSample(inst, { t, dest: bus, gain: 0.12 + 0.18 * I, pan: spread() });
        break;
      case "grains": {
        const n = Math.round(I * 4 + r() * 0.8);
        for (let k = 0; k < n; k++) playSample(inst, { t: t + r() * GRAIN_EVERY, dest: bus, gain: 0.05 + 0.08 * r(), pan: spread() });
        break;
      }
      case "shimmer": {
        // Dos copas casi iguales: la diferencia (y el "batido") crece con el dato.
        if (t < this.nextShimmer) return;
        this.nextShimmer = t + 2.5;
        const gain = 0.06 + 0.16 * I;
        playSample(inst, { t, dest: bus, midi: base, gain, pan: -0.3, dur: 3.2 });
        playSample(inst, { t, dest: bus, midi: base, gain, pan: 0.3, dur: 3.2, detune: 6 + 40 * I });
        break;
      }
      case "arpeggio":
        if (r() < 0.15 + 0.7 * I) {
          const step = [0, 2, 4, 7, 9, 12][Math.floor(r() * 6)]!;
          playSample(inst, { t, dest: bus, midi: base + step, gain: 0.08 + 0.1 * I, pan: spread(), dur: 2 });
        }
        break;
      case "plucks": {
        const n = r() < 0.2 + 0.7 * I ? 1 + Math.round(I * 2 * r()) : 0;
        for (let k = 0; k < n; k++) {
          const midi = 72 + 12 * Math.floor(r() * 2) + PENTA[Math.floor(r() * 5)]!;
          playSample(inst, { t: t + r() * GRAIN_EVERY, dest: bus, midi, gain: 0.07 + 0.08 * r(), pan: spread(), dur: 1.5 });
        }
        break;
      }
      case "chimes":
        if (r() < 0.02 + 0.1 * I) playSample(inst, { t, dest: bus, gain: 0.06 + 0.1 * I, pan: spread(), dur: 4 });
        break;
    }
  }

  /** Golpe del dato secundario (campana, timbal…), de vez en cuando. */
  private accent(t: number, pan: number) {
    const g = this.g;
    const s = this.state;
    if (!g || Math.random() >= s.secondary * 0.05) return;
    const inst = this.inst.get(this.palette.accent);
    if (!inst) return;
    const midi = 84 + PENTA[Math.floor(Math.random() * 5)]!;
    playSample(inst, { t, dest: g.textureIn, midi, gain: 0.14, pan, dur: 3 });
  }

  private tone(o: { t: number; f: number; dur: number; g: number; pan: number; bus: AudioNode; wave?: OscillatorType; attack?: number }) {
    const ctx = this.g?.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();
    osc.type = o.wave ?? "sine";
    osc.frequency.setValueAtTime(o.f, o.t);
    const attack = Math.min(o.attack ?? 0.01, o.dur / 2);
    env.gain.setValueAtTime(0.0001, o.t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g), o.t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    pan.pan.value = o.pan;
    osc.connect(env);
    env.connect(pan);
    pan.connect(o.bus);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.05);
    osc.onended = () => pan.disconnect();
  }

  private grain(o: { t: number; dur: number; g: number; f: number; q: number; pan: number; bus: AudioNode }) {
    const g = this.g;
    if (!g) return;
    const { ctx } = g;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();
    src.buffer = g.white;
    filter.type = "bandpass";
    filter.frequency.value = o.f;
    filter.Q.value = o.q;
    env.gain.setValueAtTime(0.0001, o.t);
    env.gain.exponentialRampToValueAtTime(o.g, o.t + Math.min(0.012, o.dur / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    pan.pan.value = o.pan;
    src.connect(filter);
    filter.connect(env);
    env.connect(pan);
    pan.connect(o.bus);
    src.start(o.t, Math.random() * 3);
    src.stop(o.t + o.dur + 0.03);
    src.onended = () => pan.disconnect();
  }
}
