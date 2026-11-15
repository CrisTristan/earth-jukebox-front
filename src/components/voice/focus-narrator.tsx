"use client";

import { useEffect } from "react";
import { describeElement, sectionOf } from "@/lib/voice/describe";
import { speak } from "@/lib/voice/speak";

/**
 * Teclas que mueven el foco: Tab, las flechas (grupos de radios) y Enter o
 * Espacio (abrir un panel que enfoca su primera opción).
 */
const NAV_KEYS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "]);
/** Margen entre la tecla y el cambio de foco para atribuirlo al teclado. */
const KEY_WINDOW_MS = 600;

/**
 * Lee en voz alta el botón o enlace que recibe el foco y, si cambia, la sección
 * (`data-voice-section`) en la que está. Solo con la "Guía completa".
 *
 * Solo habla cuando el foco lo mueve el teclado. Los toques, los clics y los
 * gestos de VoiceOver o TalkBack mueven el foco sin pulsar teclas, así que ahí
 * no habla y la voz no se duplica con la del lector de pantalla del móvil.
 */
export function FocusNarrator({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    let lastKeyAt = -Infinity;
    let lastSection: string | null = null;
    // En cada página nueva, el primer Tab vuelve a decir la sección.
    let lastPath = location.pathname;

    const onKeyDown = (e: KeyboardEvent) => {
      if (NAV_KEYS.has(e.key)) lastKeyAt = performance.now();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (performance.now() - lastKeyAt > KEY_WINDOW_MS) return;
      const el = e.target;
      if (!(el instanceof HTMLElement) || el === document.body) return;
      const description = describeElement(el);
      if (!description) return;
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        lastSection = null;
      }
      const section = sectionOf(el);
      const prefix = section && section !== lastSection ? `${section}. ` : "";
      lastSection = section;
      speak(prefix + description);
    };

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [active]);

  return null;
}
