/**
 * Muestras de instrumentos reales de VCSL (Versilian Community Sample Library, CC0),
 * en `public/sounds/vcsl/<instrumento>/`. Los instrumentos afinados traen algunas
 * notas (`n<midi>.mp3`) y se reafinan a la más cercana; los demás son golpes
 * sueltos (`h<n>.mp3`) que se eligen al azar.
 *
 * Si una muestra no carga, el instrumento queda en null y el motor usa su sonido
 * sintetizado de siempre: nunca se queda en silencio por un archivo.
 */

/** Notas MIDI disponibles (instrumentos afinados) o cantidad de golpes (el resto). */
export const INSTRUMENTS = {
  kalimba: [47, 51, 54, 59, 63, 66, 69],
  marimba: [36, 43, 53, 60, 67, 77, 84],
  harp: [41, 48, 55, 62, 69, 76, 83, 89, 95],
  glock: [67, 72, 79, 84, 91, 96],
  vibes: [41, 48, 55, 62, 69, 76],
  xylo: [55, 60, 67, 72, 79, 84, 91, 96],
  saxello: [46, 50, 54, 58, 62, 66, 70, 75],
  organ: [36, 42, 48, 54, 60, 66, 72, 78, 84],
  recorder: [53, 58, 62, 66, 70, 74],
  glass: [63, 66, 70, 74],
  "psaltery-bow": [58, 62, 66, 70, 74, 78],
  "psaltery-pluck": [58, 62, 66, 70, 74, 78],
  didgeridoo: 2,
  woodblock: 3,
  shaker: 3,
  cabasa: 2,
  handbell: 3,
  timpani: 2,
  chimes: 2,
  "ocean-drum": 1,
} as const satisfies Record<string, readonly number[] | number>;

export type InstrumentId = keyof typeof INSTRUMENTS;

/** Nombre de cada instrumento para decirlo en voz alta. */
export const INSTRUMENT_NAMES: Record<InstrumentId, string> = {
  kalimba: "kalimba",
  marimba: "marimba",
  harp: "harp",
  glock: "glockenspiel",
  vibes: "vibraphone",
  xylo: "xylophone",
  saxello: "saxello",
  organ: "organ",
  recorder: "recorder",
  glass: "wine glasses",
  "psaltery-bow": "bowed psaltery",
  "psaltery-pluck": "plucked psaltery",
  didgeridoo: "didgeridoo",
  woodblock: "woodblock",
  shaker: "shaker",
  cabasa: "cabasa",
  handbell: "hand bells",
  timpani: "timpani",
  chimes: "wind chimes",
  "ocean-drum": "ocean drum",
};

export interface Instrument {
  id: InstrumentId;
  /** Afinado: cada muestra tiene su nota y se reafina. Si no, golpes sueltos. */
  pitched: boolean;
  samples: { note: number | null; buffer: AudioBuffer }[];
}

const BASE = "/sounds/vcsl";

/** Muestras ya decodificadas, por contexto de audio (un `AudioBuffer` no se comparte entre contextos). */
const cache = new WeakMap<BaseAudioContext, Map<InstrumentId, Promise<Instrument | null>>>();
/** Archivos descargados una sola vez, compartidos por todos los contextos. */
const files = new Map<string, Promise<ArrayBuffer>>();

function fetchFile(url: string): Promise<ArrayBuffer> {
  let p = files.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.arrayBuffer();
    });
    p.catch(() => files.delete(url));
    files.set(url, p);
  }
  // `decodeAudioData` se queda con el buffer: cada contexto decodifica una copia.
  return p.then((b) => b.slice(0));
}

/** Descarga y decodifica un instrumento para `ctx`; null si alguna muestra falla. */
export function loadInstrument(ctx: BaseAudioContext, id: InstrumentId): Promise<Instrument | null> {
  let byId = cache.get(ctx);
  if (!byId) cache.set(ctx, (byId = new Map()));
  let p = byId.get(id);
  if (!p) {
    const spec = INSTRUMENTS[id];
    const list: { note: number | null; url: string }[] = typeof spec === "number"
      ? Array.from({ length: spec }, (_, i) => ({ note: null, url: `${BASE}/${id}/h${i + 1}.mp3` }))
      : spec.map((note) => ({ note, url: `${BASE}/${id}/n${note}.mp3` }));
    p = Promise.all(list.map(async ({ note, url }) => ({ note, buffer: await ctx.decodeAudioData(await fetchFile(url)) })))
      .then((samples) => ({ id, pitched: typeof spec !== "number", samples }))
      .catch(() => null);
    byId.set(id, p);
  }
  return p;
}

export interface SampleOptions {
  /** Instante de inicio (tiempo del contexto). */
  t: number;
  dest: AudioNode;
  /** Nota MIDI (instrumentos afinados); se ignora en los golpes. */
  midi?: number;
  gain: number;
  pan?: number;
  /** Duración máxima (s): después se apaga suave. Sin ella suena la muestra completa. */
  dur?: number;
  /** Desafinación en cents (para que dos voces "vibren" entre sí). */
  detune?: number;
  /** Segundos de la muestra que se saltan (p. ej. el golpe inicial de un dron). */
  offset?: number;
  /** Entrada en fundido (s), en lugar de empezar de golpe. */
  fadeIn?: number;
}

/** Toca una muestra. Devuelve false si el instrumento no tiene muestras. */
export function playSample(inst: Instrument, o: SampleOptions): boolean {
  const ctx = o.dest.context;
  if (inst.samples.length === 0) return false;
  let sample = inst.samples[Math.floor(Math.random() * inst.samples.length)]!;
  let rate = 1 + (Math.random() - 0.5) * 0.04; // golpes: un poco de variación natural
  if (inst.pitched && o.midi != null) {
    const midi = o.midi;
    sample = inst.samples.reduce((best, s) => (Math.abs(s.note! - midi) < Math.abs(best.note! - midi) ? s : best));
    rate = 2 ** ((midi - sample.note!) / 12);
  }
  const src = ctx.createBufferSource();
  src.buffer = sample.buffer;
  src.playbackRate.value = rate;
  if (o.detune) src.detune.value = o.detune;
  const env = ctx.createGain();
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
  const offset = Math.min(o.offset ?? 0, sample.buffer.duration * 0.5);
  if (o.fadeIn) {
    env.gain.setValueAtTime(0.0001, o.t);
    env.gain.linearRampToValueAtTime(o.gain, o.t + o.fadeIn);
  } else {
    env.gain.setValueAtTime(o.gain, o.t);
  }
  const length = (sample.buffer.duration - offset) / rate;
  const end = o.dur != null ? Math.min(o.dur, length) : length;
  if (o.dur != null && o.dur < length) env.gain.setTargetAtTime(0.0001, o.t + o.dur, 0.08);
  src.connect(env);
  env.connect(pan);
  pan.connect(o.dest);
  src.start(o.t, offset);
  src.stop(o.t + end + 0.5);
  src.onended = () => pan.disconnect();
  return true;
}
