"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Reveal } from "@/components/how/reveal";
import { colorOfValue, loadColorTable, type ColorTable } from "@/lib/how/color-table";

export interface FrameNumbers {
  mean: number | null;
  dense: number | null;
  elevated: number | null;
  p95: number | null;
  lat: number | null;
  lon: number | null;
}

const CW = 960;
const CH = 480;
const DURATION = 2600;

/**
 * Paso 2: la imagen se convierte en la cuadrícula de 24×48 que guarda el motor,
 * celda por celda, y aparecen los números que resumen el frame.
 */
export function GridReveal({ image, grid, table: tableUrl, numbers, unit, cuts }: {
  image: string;
  grid: (number | null)[][];
  table: string;
  numbers: FrameNumbers;
  unit: string;
  cuts: [number, number];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [table, setTable] = useState<ColorTable | null>(null);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadColorTable(tableUrl).then((t) => alive && setTable(t), () => {});
    return () => {
      alive = false;
    };
  }, [tableUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !table || run === 0) return;
    const img = new Image();
    img.src = image;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let start = 0;
    const paint = (ms: number) => {
      start ||= ms;
      const p = still ? 1 : Math.min(1, (ms - start) / DURATION);
      ctx.clearRect(0, 0, CW, CH);
      ctx.globalAlpha = 1 - 0.75 * p;
      if (img.complete) ctx.drawImage(img, 0, 0, CW, CH);
      ctx.globalAlpha = 1;
      const cw = CW / cols;
      const ch = CH / rows;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          // Las celdas aparecen en diagonal, de la esquina superior izquierda a la inferior derecha.
          const local = Math.max(0, Math.min(1, p * 2.2 - ((i / rows + j / cols) / 2) * 1.2));
          if (local <= 0) continue;
          const v = grid[i]?.[j];
          const s = 0.35 + 0.6 * local;
          const x = j * cw + (cw * (1 - s)) / 2;
          const y = i * ch + (ch * (1 - s)) / 2;
          if (v == null) {
            ctx.fillStyle = `rgba(255,255,255,${0.05 * local})`;
          } else {
            const [r, g, b] = colorOfValue(table, v);
            ctx.fillStyle = `rgba(${r},${g},${b},${local})`;
          }
          ctx.beginPath();
          ctx.roundRect(x, y, cw * s, ch * s, 3);
          ctx.fill();
          // Celdas por encima de los umbrales: un borde que las destaca.
          if (v != null && v >= cuts[1] && local === 1) {
            ctx.strokeStyle = "rgba(255,255,255,.85)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
      // Centro del dato: de ahí sale el sonido (izquierda/derecha).
      if (p === 1 && numbers.lon != null && numbers.lat != null) {
        const x = ((numbers.lon + 180) / 360) * CW;
        const y = ((90 - numbers.lat) / 180) * CH;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 2 * Math.PI);
        ctx.stroke();
      }
      if (p < 1) raf = requestAnimationFrame(paint);
      else setDone(true);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [run, table, image, grid, cuts, numbers]);

  const fmt = (v: number | null, digits = 1) => (v == null ? "—" : v.toFixed(digits));
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const cards = [
    { k: "Average", v: `${fmt(numbers.mean)} ${unit}`, hint: "Sets the note of the melody" },
    { k: `Dense smoke (≥ ${cuts[1]} ${unit})`, v: pct(numbers.dense), hint: "How much texture you hear" },
    { k: `Elevated (≥ ${cuts[0]} ${unit})`, v: pct(numbers.elevated), hint: "How often the bells ring" },
    { k: "Highest values (95th percentile)", v: `${fmt(numbers.p95)} ${unit}`, hint: "How bright the sound is" },
    { k: "Center of the data", v: numbers.lon == null ? "—" : `${Math.abs(numbers.lon).toFixed(0)}° ${numbers.lon < 0 ? "W" : "E"}`, hint: "Where the sound comes from: left or right" },
  ];

  return (
    <Reveal onShow={() => setRun(1)}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="relative">
          <canvas ref={canvasRef} width={CW} height={CH} role="img"
            aria-label={`The frame turned into a grid of ${grid.length} by ${grid[0]?.length ?? 0} cells, each with the average value of its area.`}
            className="aspect-[2/1] w-full rounded-lg bg-black/40 ring-1 ring-white/15" />
          {done && (
            <button type="button" onClick={() => { setDone(false); setRun((n) => n + 1); }}
              className="glass-light absolute bottom-3 right-3 flex items-center gap-2 rounded-md bg-black/55 px-3 py-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Replay
            </button>
          )}
        </div>
        <ul className="grid gap-2">
          {cards.map((c, i) => (
            <li key={c.k} className="glass flex items-center justify-between gap-4 rounded-lg px-4 py-3 transition-[opacity,translate] duration-700"
              style={{ opacity: done ? 1 : 0.15, translate: done ? "0 0" : "12px 0", transitionDelay: `${i * 120}ms` }}>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-glass-muted">{c.k}</p>
                <p className="text-xs text-glass-muted/80">{c.hint}</p>
              </div>
              <p className="shrink-0 font-display text-3xl tabular-nums">{c.v}</p>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
