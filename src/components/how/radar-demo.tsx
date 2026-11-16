"use client";

/* eslint-disable @next/next/no-img-element -- el frame se lee en un canvas */

import { useEffect, useRef } from "react";
import { buildDots, drawRadar, readPixels, type RadarDot } from "@/lib/explore/radar-dots";
import { gridValue } from "@/lib/geo/projection";
import { RADAR_SHORTCUTS } from "@/lib/shortcuts";

/**
 * Paso 4: el radar sobre un frame real (sin sonido): bolitas con el color del mapa,
 * más grandes donde el dato es más alto, y la flecha que gira.
 */
export function RadarDemo({ image, grid, scale, cuts }: {
  image: string;
  grid: (number | null)[][];
  scale: { low: number; top: number } | null;
  cuts: number[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dots: RadarDot[] = [];
    let view = { cx: 0, cy: 0, R: 0 };
    const rebuild = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const img = imgRef.current;
      const pixels = img?.complete && img.naturalWidth ? readPixels(img) : null;
      view = { cx: w * 0.64, cy: h * 0.42, R: Math.min(w, h) * 0.36 };
      dots = buildDots({
        ...view,
        map: { left: 0, top: 0, width: w, height: h },
        pixels,
        sample: (u, v) => {
          const raw = gridValue(grid, u, v);
          if (raw == null) return { band: null, value: null };
          const value = scale ? Math.max(0, Math.min(1, (raw - scale.low) / (scale.top - scale.low))) : 0.5;
          return { band: cuts.filter((c) => raw >= c).length, value };
        },
        fallback: () => "#fff",
      });
    };
    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(wrap);
    imgRef.current?.addEventListener("load", rebuild);
    let raf = 0;
    const paint = (ms: number) => {
      ctx.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight);
      drawRadar(ctx, { ...view, arrow: (ms / 12000) * 2 * Math.PI - Math.PI / 2, reach: 1, dots, t: ms / 1000, still });
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    const img = imgRef.current;
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      img?.removeEventListener("load", rebuild);
    };
  }, [grid, scale, cuts]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div ref={wrapRef} className="relative aspect-[2/1] w-full overflow-hidden rounded-lg ring-1 ring-white/15">
        <img ref={imgRef} src={image} alt="The radar over the carbon monoxide map: colored dots around a point and an arrow that turns." className="absolute inset-0 h-full w-full object-fill" />
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <ul className="glass space-y-3 rounded-lg p-5 text-sm leading-relaxed">
          <li><span className="font-semibold">A soft, continuous tone</span> <span className="text-glass-muted">follows the arrow. It rises where that direction is above the average of the whole circle, and falls where it&apos;s below.</span></li>
          <li><span className="font-semibold">A note of the dataset&apos;s instrument</span> <span className="text-glass-muted">plays only when something changes under the arrow: a new level or a jump in the data.</span></li>
          <li><span className="font-semibold">Silence</span> <span className="text-glass-muted">where there is no data, like land or space.</span></li>
        </ul>
        <div className="glass rounded-lg p-5">
          <p className="text-xs uppercase tracking-widest text-glass-muted">Keyboard</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {RADAR_SHORTCUTS.map(([k, v]) => (
              <li key={k} className="flex gap-3"><kbd className="w-28 shrink-0 font-semibold">{k}</kbd><span className="text-glass-muted">{v}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
