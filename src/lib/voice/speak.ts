/**
 * Voz del sitio con la síntesis de voz del navegador (`speechSynthesis`),
 * usando la mejor voz femenina en inglés de EE. UU. disponible.
 *
 * Los navegadores no dejan hablar hasta que la persona interactúa con la
 * página: el mensaje queda pendiente y suena con el primer toque, clic o tecla.
 *
 * Móvil:
 * - iOS solo habilita la voz si la primera frase se pide de forma síncrona
 *   dentro de un gesto. Por eso `speak` es síncrona y, en el primer gesto, se
 *   dice el mensaje pendiente (o una frase muda) ahí mismo.
 * - En pantallas táctiles `pointerdown` no cuenta como gesto: se escuchan
 *   `pointerup`, `touchend`, `click` y `keydown`.
 * - En iPhone no se oye con el interruptor de silencio activado.
 */

const GESTURES = ["pointerup", "touchend", "click", "keydown"] as const;

let unlocked = false;
let pending: string | null = null;
/** Referencia a la frase en curso: Chrome puede recolectarla antes de que termine. */
let current: SpeechSynthesisUtterance | null = null;
/** undefined = hay que recalcularla (las voces cargan de forma asíncrona). */
let cachedVoice: SpeechSynthesisVoice | null | undefined;

function getSynth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

// ---- Elección de voz ----

const FEMALE = /aria|jenny|ava|emma|michelle|samantha|zira|allison|susan|joanna|salli|kimberly|google us english/i;
/** Voces de fantasía de Apple que vienen marcadas como en-US. */
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;

function scoreVoice(v: SpeechSynthesisVoice): number {
  if (NOVELTY.test(v.name)) return -1;
  const lang = v.lang.replace("_", "-"); // algunos Android usan "en_US"
  let s = 0;
  if (lang === "en-US") s += 10;
  else if (lang.startsWith("en")) s += 4;
  else return -1;
  if (/natural|neural|online|premium|enhanced/i.test(v.name)) s += 6; // voces neuronales: mucho más naturales
  if (FEMALE.test(v.name)) s += 3;
  if (/google/i.test(v.name)) s += 2;
  return s;
}

function bestVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = synth.getVoices();
  if (!voices.length) return null; // aún cargando: `lang` basta para que el sistema elija
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = scoreVoice(v);
    if (s > bestScore) [best, bestScore] = [v, s];
  }
  cachedVoice = best;
  return best;
}

// ---- Reproducción ----

function utter(synth: SpeechSynthesis, text: string, volume = 1) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 1;
  u.pitch = 1;
  u.volume = volume;
  const voice = bestVoice(synth);
  if (voice) u.voice = voice;
  // Cancelar sin que haya nada sonando puede hacer que Chrome pierda la frase siguiente.
  if (synth.speaking || synth.pending) synth.cancel();
  synth.resume(); // iOS y Chrome a veces se quedan en pausa
  current = u;
  u.onend = u.onerror = () => {
    if (current === u) current = null;
  };
  synth.speak(u);
}

// ---- Activación del usuario ----

function hasUserActivation(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua?.hasBeenActive ?? false;
}

function onFirstGesture() {
  unlocked = true;
  for (const type of GESTURES) window.removeEventListener(type, onFirstGesture, true);
  const synth = getSynth();
  if (!synth) return;
  const next = pending;
  pending = null;
  // Hablar dentro del gesto deja la voz habilitada en iOS para el resto de la visita.
  if (next) utter(synth, next);
  else utter(synth, " ", 0);
}

// ---- API pública ----

/** Detiene lo que esté sonando (y lo pendiente). */
export function stopSpeaking() {
  pending = null;
  getSynth()?.cancel();
}

/** Dice `text`, interrumpiendo lo que estuviera sonando. */
export function speak(text: string) {
  const synth = getSynth();
  if (!synth || !text.trim()) return;
  if (!unlocked && !hasUserActivation()) {
    pending = text;
    return;
  }
  pending = null;
  utter(synth, text);
}

const synth = getSynth();
if (synth) {
  synth.getVoices(); // empieza a cargar las voces
  synth.addEventListener?.("voiceschanged", () => {
    cachedVoice = undefined;
  });
  for (const type of GESTURES) window.addEventListener(type, onFirstGesture, true);
}
