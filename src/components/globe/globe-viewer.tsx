"use client";

/* eslint-disable @next/next/no-img-element -- sin WebGL se muestra el frame plano, tal cual */

import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type Ref } from "react";
import { TriangleAlert } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import type { CameraControls, GlobeScene, GlobeView } from "@/lib/globe";
import type { ControlMode, GeoBounds } from "@/lib/globe/types";

/** Acciones del visor que la interfaz puede pedir (teclado y botones). */
export interface GlobeViewerHandle {
  recenter(): void;
  rotateBy(dYaw: number, dPitch: number): void;
  zoomBy(factor: number): void;
  /** Foto de lo que se ve ahora (para leer el mapa desde la pantalla), o null si aún no hay escena. */
  view(): GlobeView | null;
}

interface GlobeViewerProps {
  urls: readonly string[];
  bounds: GeoBounds;
  /** Frame actual y mezcla con el siguiente (0–1). */
  index: number;
  blend: number;
  controlMode: ControlMode;
  /** Descripción para lectores de pantalla (el canvas es decorativo). */
  label: string;
  /** El sensor no envía datos (p. ej. un portátil sin giroscopio). */
  onOrientationUnavailable?: () => void;
  /** Cambió lo que se ve (la cámara se movió o cambió el tamaño). Se llama hasta en cada fotograma. */
  onViewChange?: () => void;
  ref?: Ref<GlobeViewerHandle>;
  className?: string;
}

type Status = "loading" | "ready" | "unsupported";

/** Si en este tiempo no llega ninguna lectura del sensor, el dispositivo no lo tiene. */
const ORIENTATION_TIMEOUT_MS = 1500;

/**
 * Lienzo del globo interior. Monta `GlobeScene` (three.js, cargado con `import()`
 * para no pesar en el resto del sitio) y le pasa los cambios por métodos, sin
 * volver a crear la escena.
 */
export function GlobeViewer({ urls, bounds, index, blend, controlMode, label, onOrientationUnavailable, onViewChange, ref, className = "" }: GlobeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const viewChanged = useEffectEvent(() => onViewChange?.());
  const controlsRef = useRef<CameraControls | null>(null);
  const [scene, setScene] = useState<GlobeScene | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [engine, setEngine] = useState<typeof import("@/lib/globe") | null>(null);

  // ---- Montaje: carga three.js y crea la escena una sola vez ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let created: GlobeScene | null = null;
    let cancelled = false;

    import("@/lib/globe").then((mod) => {
      if (cancelled) return;
      if (!mod.supportsWebGL()) {
        setStatus("unsupported");
        return;
      }
      created = new mod.GlobeScene(container, { onFrameShown: () => setStatus("ready"), onViewChange: () => viewChanged() });
      sceneRef.current = created;
      setEngine(mod);
      setScene(created);
    }, () => {
      if (!cancelled) setStatus("unsupported");
    });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      created?.dispose();
    };
  }, []);

  // ---- Secuencia de imágenes ----
  useEffect(() => {
    scene?.setSequence(urls, bounds);
  }, [scene, urls, bounds]);

  // ---- Frame actual ----
  useEffect(() => {
    scene?.showFrame(index, blend);
  }, [scene, index, blend]);

  // ---- Control de cámara ----
  const reportNoSensor = useEffectEvent(() => onOrientationUnavailable?.());
  useEffect(() => {
    if (!scene || !engine) return;
    const controls = engine.createControls(controlMode, scene.canvas);
    controlsRef.current = controls;
    scene.setControls(controls);

    let timer: number | undefined;
    if (controls instanceof engine.OrientationControls) {
      timer = window.setTimeout(() => {
        if (!controls.active) reportNoSensor();
      }, ORIENTATION_TIMEOUT_MS);
    }
    return () => {
      window.clearTimeout(timer);
      scene.setControls(null);
      controlsRef.current = null;
    };
  }, [scene, engine, controlMode]);

  useImperativeHandle(ref, () => ({
    recenter: () => controlsRef.current?.recenter(),
    rotateBy: (dYaw, dPitch) => controlsRef.current?.rotateBy?.(dYaw, dPitch),
    zoomBy: (factor) => controlsRef.current?.zoomBy?.(factor),
    view: () => sceneRef.current?.view() ?? null,
  }), []);

  return (
    <div role="img" aria-label={label} className={`relative overflow-hidden bg-black ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <LoadingSpinner label="Loading the globe…" />
        </div>
      )}

      {status === "unsupported" && (
        <div className="absolute inset-0">
          {urls[index] && <img src={urls[index]} alt="" className="h-full w-full object-contain" />}
          <p className="glass absolute left-1/2 top-24 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm">
            <TriangleAlert aria-hidden className="h-4 w-4 text-amber-300" /> This browser can&apos;t show 3D, so the flat map is shown.
          </p>
        </div>
      )}
    </div>
  );
}
