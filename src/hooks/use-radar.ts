"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { DiscGrid } from "@/lib/explore/disc";
import { Explorer } from "@/lib/explore/explorer";
import type { DataBand } from "@/lib/player";

interface RadarOptions {
  /** Modo explorar activo: al desactivarlo, el radar se calla. */
  active: boolean;
  grid: DiscGrid | null;
  bands: DataBand[];
  /** 0–100 (0 = silencio). */
  volume: number;
  /** Perfil del motor: con qué instrumento suena el radar (`palettes.ts`). */
  profileId: string | null;
  /** Posición de la flecha (en pasos) y anillos que alcanza, para dibujarla sobre el mapa. */
  onArrow: (pos: number, reach: number) => void;
  /** Canvas cuadrado donde dibujar el disco del radar (opcional; sin él, el radar no tiene vista). */
  canvas?: HTMLCanvasElement | null;
  /** Empezó o paró la vuelta (el audio ya suena, o se calló). */
  onPlayingChange?: (playing: boolean) => void;
}

/**
 * Radar de "Capas de la Tierra" sin interfaz propia: gira alrededor del origen
 * (que sigue al cursor sobre el mapa) y suena los niveles del dato que encuentra.
 * Se maneja con el ratón sobre el mapa y con el teclado; no necesita vista.
 */
export function useRadar({ active, grid, bands, volume, profileId, onArrow, canvas = null, onPlayingChange }: RadarOptions) {
  const [explorer] = useState(() => new Explorer());
  const [playing, setPlaying] = useState(false);
  const playingChanged = useEffectEvent((on: boolean) => {
    setPlaying(on);
    onPlayingChange?.(on);
  });

  useEffect(() => {
    explorer.on({ onPosition: (pos) => onArrow(pos, explorer.getReach()), onPlaying: (on) => playingChanged(on) });
  }, [explorer, onArrow]);
  useEffect(() => () => explorer.dispose(), [explorer]);
  useEffect(() => {
    explorer.attach(canvas);
    return () => explorer.attach(null);
  }, [explorer, canvas]);
  useEffect(() => explorer.setGrid(grid), [explorer, grid]);
  useEffect(() => explorer.setBands(bands), [explorer, bands]);
  useEffect(() => explorer.setVolume(volume), [explorer, volume]);
  useEffect(() => explorer.setPalette(profileId), [explorer, profileId]);
  useEffect(() => {
    if (!active) explorer.pause();
  }, [explorer, active]);

  return {
    playing,
    /** Empieza a girar. Llamar dentro de un gesto (clic o tecla): crea el audio. */
    start: () => {
      if (!explorer.isPlaying()) void explorer.toggle();
    },
    stop: () => explorer.pause(),
    toggle: () => explorer.toggle(),
  };
}
