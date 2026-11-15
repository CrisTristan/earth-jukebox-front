"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** Movimiento mínimo (px) antes de decidir si es un arrastre. */
const SLOP = 8;
/** Velocidad (px/ms) a partir de la cual un gesto corto cuenta como "flick". */
const FLICK = 0.5;

type Options = {
  /** Eje en el que se mueve el panel. */
  axis: "x" | "y";
  /** Sentido en el que se esconde: 1 = hacia la derecha/abajo, -1 = hacia la izquierda/arriba. */
  hideSign: 1 | -1;
  open: boolean;
  onChange: (open: boolean) => void;
  /** Sin activar, los handlers no hacen nada. */
  enabled: boolean;
};

type Drag = {
  id: number;
  startX: number;
  startY: number;
  startOpen: boolean;
  active: boolean;
  size: number;
  offset: number;
  lastMain: number;
  lastT: number;
  velocity: number;
};

/**
 * Panel que se muestra o esconde arrastrándolo con el dedo.
 *
 * Devuelve handlers de puntero para el panel (`panelRef`) y para su pestaña o
 * asa. Mientras se arrastra, el panel sigue al dedo con `translate` en línea.
 * Al soltar, se quitan los estilos en línea y la transición CSS del panel lo
 * lleva a su posición final (abierto o cerrado según `open`).
 */
export function useDrawerSwipe(panelRef: RefObject<HTMLElement | null>, { axis, hideSign, open, onChange, enabled }: Options) {
  const dragRef = useRef<Drag | null>(null);

  const place = (panel: HTMLElement, offset: number) => {
    const v = `${offset * hideSign}px`;
    panel.style.translate = axis === "x" ? `${v} 0` : `0 ${v}`;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as Element).closest('input[type="range"]')) return; // el slider tiene su propio arrastre
    dragRef.current = {
      id: e.pointerId, startX: e.clientX, startY: e.clientY, startOpen: open,
      active: false, size: 0, offset: 0, lastMain: 0, lastT: e.timeStamp, velocity: 0,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const main = axis === "x" ? dx : dy;
    const cross = axis === "x" ? dy : dx;

    if (!d.active) {
      if (Math.abs(cross) > SLOP && Math.abs(cross) >= Math.abs(main)) {
        dragRef.current = null; // gesto en el otro eje (p. ej. scroll de la lista)
        return;
      }
      if (Math.abs(main) < SLOP) return;
      const panel = panelRef.current;
      if (!panel) {
        dragRef.current = null;
        return;
      }
      d.active = true;
      d.size = axis === "x" ? panel.offsetWidth : panel.offsetHeight;
      panel.style.transition = "none";
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const panel = panelRef.current;
    if (!panel) return;
    // Desplazamiento en el sentido de esconder: 0 = abierto, size = cerrado.
    const moved = main * hideSign;
    d.offset = Math.max(0, Math.min(d.size, d.startOpen ? moved : d.size + moved));
    place(panel, d.offset);

    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = ((main - d.lastMain) * hideSign) / dt;
    d.lastMain = main;
    d.lastT = e.timeStamp;
  };

  const finish = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (!d.active) return;

    const panel = panelRef.current;
    if (panel) {
      panel.style.translate = "";
      panel.style.transition = "";
    }
    // Un arrastre no debe acabar en clic sobre el botón que haya debajo.
    const stop = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("click", stop, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", stop, true), 350);

    if (cancelled) return;
    let close: boolean;
    if (d.velocity > FLICK) close = true;
    else if (d.velocity < -FLICK) close = false;
    else close = d.offset > d.size * (d.startOpen ? 0.35 : 0.65);
    onChange(!close);
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
  };
}
