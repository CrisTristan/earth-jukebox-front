"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Megaphone, MegaphoneOff } from "lucide-react";
import { useVoice, VOICE_MODES } from "@/components/voice/voice-context";

type Variant = "nav" | "compact" | "icon";

// La barra superior tiene `backdrop-filter`, así que `fixed` se coloca respecto a ella
// (justo debajo) y no lo recorta el `overflow` de la lista de enlaces.
const BELOW_TOP_BAR = "fixed right-4 top-full mt-2 md:right-10";

const PANEL_POSITION: Record<Variant, string> = {
  nav: BELOW_TOP_BAR,
  compact: BELOW_TOP_BAR,
  // En el reproductor se abre hacia arriba, como el menú de sonido.
  icon: "absolute bottom-14 right-0",
};

/**
 * Selector de la guía por voz: Off · Full guide.
 *
 * `nav` es el enlace de texto de la barra superior; `compact`, su icono en la barra
 * móvil; `icon`, el botón del megáfono del reproductor. El panel se cierra con
 * Escape, con un clic fuera o al salir de él con Tab.
 */
export function VoiceSettings({ variant, className = "" }: { variant: Variant; className?: string }) {
  const { mode, setMode } = useVoice();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const current = VOICE_MODES.find((m) => m.value === mode) ?? VOICE_MODES[0];
  const VoiceIcon = mode === "off" ? MegaphoneOff : Megaphone;

  useEffect(() => {
    if (!open) return;
    // Al abrir, el foco va a la opción elegida.
    rootRef.current?.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Sin `relatedTarget` el foco no fue a ningún sitio (p. ej. al tocar el texto de una
    // opción); los clics fuera ya los cierra el listener de `pointerdown`.
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next)) setOpen(false);
  };

  return (
    <div ref={rootRef} onBlur={onBlur} className={variant === "icon" ? "relative" : ""}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Voice guide: ${current.label}`}
        title={`Voice guide: ${current.label}`}
        className={className}
      >
        {variant === "nav" ? (
          "Voice"
        ) : (
          <VoiceIcon aria-hidden className={variant === "compact" ? "size-[18px]" : "h-4 w-4"} strokeWidth={variant === "compact" ? 1.75 : 2} />
        )}
      </button>

      {open && (
        <div
          id={panelId}
          data-voice-section="Voice guide settings"
          className={`glass-strong jb-enter z-50 w-72 rounded-2xl p-4 text-left normal-case tracking-normal ${PANEL_POSITION[variant]}`}
        >
          <fieldset>
            <legend className="px-1 text-[10px] font-semibold uppercase tracking-widest text-glass-muted">Voice guide</legend>
            <div className="mt-2 space-y-1">
              {VOICE_MODES.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer gap-3 rounded-xl px-3 py-2 transition hover:bg-white/15 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal-400 ${m.value === mode ? "bg-white/20" : ""}`}
                >
                  <input
                    type="radio"
                    name={`${panelId}-mode`}
                    value={m.value}
                    checked={m.value === mode}
                    onChange={() => setMode(m.value)}
                    className="mt-1 accent-teal-400 focus:outline-none"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-glass">{m.label}</span>
                    <span className="block text-xs text-glass-muted">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 px-1 text-xs leading-relaxed text-glass-muted">
            If you use VoiceOver, TalkBack or another screen reader, keep this Off to avoid hearing two voices.
            Press <kbd className="font-semibold text-glass">V</kbd> to turn the voice guide on or off.
          </p>
        </div>
      )}
    </div>
  );
}
