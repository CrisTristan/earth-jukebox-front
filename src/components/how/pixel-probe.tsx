"use client";

/* eslint-disable @next/next/no-img-element -- el frame se mide píxel a píxel en un canvas */

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { entryPosition, entryValue, loadColorTable, nearestEntry, type ColorEntry, type ColorTable } from "@/lib/how/color-table";

type Box = readonly [number, number, number, number];

/** Lo que hay bajo la sonda: un dato, algo que el motor ignora o un color que no es dato. */
type Reading =
  | { kind: "data"; rgb: [number, number, number]; entry: ColorEntry }
  | { kind: "masked"; rgb: [number, number, number]; what: string }
  | { kind: "none"; rgb: [number, number, number] };

const W = 640;
const H = 320;

/**
 * Paso 1: el motor lee el color de cada píxel y lo busca en la tabla de color oficial.
 * La persona mueve una sonda (puntero, toque o flechas) y ve el color, dónde cae en
 * la barra de color y el valor; "Engine view" oscurece lo que no cuenta como dato.
 */
export function PixelProbe({ image, table: tableUrl, masks }: { image: string; table: string; masks: { box: Box; what: string }[] }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const pixels = useRef<Uint8ClampedArray | null>(null);
  const [table, setTable] = useState<ColorTable | null>(null);
  const [probe, setProbe] = useState({ u: 0.62, v: 0.36 });
  const [reading, setReading] = useState<Reading | null>(null);
  const [engineView, setEngineView] = useState(false);
  const [share, setShare] = useState<{ data: number; masked: number; none: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void loadColorTable(tableUrl).then((t) => alive && setTable(t), () => {});
    return () => {
      alive = false;
    };
  }, [tableUrl]);

  const maskAt = (u: number, v: number) => masks.find(({ box: [l, t, r, b] }) => u >= l && u <= r && v >= t && v <= b);

  const read = (u: number, v: number): Reading | null => {
    const px = pixels.current;
    if (!px || !table) return null;
    const i = (Math.min(H - 1, Math.floor(v * H)) * W + Math.min(W - 1, Math.floor(u * W))) * 4;
    const rgb: [number, number, number] = [px[i]!, px[i + 1]!, px[i + 2]!];
    const mask = maskAt(u, v);
    if (mask) return { kind: "masked", rgb, what: mask.what };
    const entry = nearestEntry(table, ...rgb);
    return entry ? { kind: "data", rgb, entry } : { kind: "none", rgb };
  };

  const drawLoupe = (p: { u: number; v: number }) => {
    const loupe = loupeRef.current;
    const img = imgRef.current;
    const ctx = loupe?.getContext("2d");
    if (!loupe || !img?.naturalWidth || !ctx) return;
    // La lupa muestra un cuadrado de 1/40 del ancho del mapa.
    const sw = img.naturalWidth / 40;
    const sx = p.u * img.naturalWidth - sw / 2;
    const sy = p.v * img.naturalHeight - sw / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, loupe.width, loupe.height);
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, loupe.width, loupe.height);
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 2;
    const m = loupe.width / 2;
    ctx.strokeRect(m - 6, m - 6, 12, 12);
  };

  /** Lee los píxeles y prepara la "vista del motor" (lo que no es dato, oscurecido). */
  const analyze = () => {
    const img = imgRef.current;
    const overlay = overlayRef.current;
    if (!img?.naturalWidth || !table || !overlay) return;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    pixels.current = data;
    overlay.width = W;
    overlay.height = H;
    const octx = overlay.getContext("2d");
    if (!octx) return;
    const out = octx.createImageData(W, H);
    let nData = 0;
    let nMasked = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const u = (x + 0.5) / W;
        const v = (y + 0.5) / H;
        if (maskAt(u, v)) {
          // Ignorado a propósito: rayas ámbar.
          const stripe = (x + y) % 10 < 5;
          out.data.set([255, 194, 61, stripe ? 150 : 60], i);
          nMasked++;
        } else if (nearestEntry(table, data[i]!, data[i + 1]!, data[i + 2]!)) {
          nData++;
        } else {
          out.data.set([6, 8, 16, 215], i);
        }
      }
    }
    octx.putImageData(out, 0, 0);
    const total = W * H;
    setShare({ data: nData / total, masked: nMasked / total, none: (total - nData - nMasked) / total });
    setReading(read(probe.u, probe.v));
    drawLoupe(probe);
  };

  // La tabla y la imagen llegan por separado: se analiza cuando están las dos.
  useEffect(() => {
    if (table && imgRef.current?.complete) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const moveTo = (u: number, v: number) => {
    const p = { u: Math.max(0, Math.min(0.999, u)), v: Math.max(0, Math.min(0.999, v)) };
    setProbe(p);
    setReading(read(p.u, p.v));
    drawLoupe(p);
  };

  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    moveTo((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 0.08 : 0.02;
    const m = ({ ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] } as Record<string, [number, number]>)[e.key];
    if (!m) return;
    e.preventDefault();
    moveTo(probe.u + m[0], probe.v + m[1]);
  };

  const label = !reading ? "Loading the color table…"
    : reading.kind === "data" ? `${entryValue(reading.entry).toFixed(1)} ${table?.units ?? ""}`
      : reading.kind === "masked" ? `Ignored: ${reading.what}`
        : "Not data: land, coastline or text";
  const swatch = reading ? `rgb(${reading.rgb.join(",")})` : "transparent";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div
        role="application"
        tabIndex={0}
        aria-label="Carbon monoxide map. Move the probe with the pointer or the arrow keys to read a pixel."
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onKeyDown={onKey}
        className="group relative aspect-[2/1] w-full cursor-crosshair touch-none overflow-hidden rounded-lg ring-1 ring-white/15 focus-visible:outline-4 focus-visible:outline-amber-300"
      >
        <img ref={imgRef} src={image} alt="" onLoad={analyze} className="absolute inset-0 h-full w-full select-none object-fill" draggable={false} />
        <canvas ref={overlayRef} aria-hidden className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${engineView ? "opacity-100" : "opacity-0"}`} />
        {/* Sonda y lupa */}
        <div aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${probe.u * 100}%`, top: `${probe.v * 100}%` }}>
          <span className="block h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,.5)]" />
        </div>
        <div aria-hidden className="pointer-events-none absolute"
          style={{ left: `calc(${probe.u * 100}% + ${probe.u > 0.75 ? -128 : 18}px)`, top: `calc(${probe.v * 100}% + ${probe.v > 0.6 ? -128 : 18}px)` }}>
          <canvas ref={loupeRef} width={110} height={110} className="h-[110px] w-[110px] rounded-full border-2 border-white/80 bg-black shadow-2xl" />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="glass rounded-lg p-5" aria-live="polite">
          <p className="text-xs uppercase tracking-widest text-glass-muted">Under the probe</p>
          <div className="mt-3 flex items-center gap-4">
            <span className="h-14 w-14 shrink-0 rounded-lg ring-1 ring-white/30" style={{ background: swatch }} />
            <div className="min-w-0">
              <p className="font-display text-4xl leading-none">{label}</p>
              {reading && <p className="mt-1 font-mono text-xs text-glass-muted">rgb({reading.rgb.join(", ")})</p>}
            </div>
          </div>
          {/* Barra de color oficial con la posición del píxel */}
          {table && (
            <div className="mt-5">
              <div className="relative h-4 overflow-hidden rounded-full" style={{ background: `linear-gradient(90deg, ${table.entries.filter((_, i) => i % 4 === 0).map((e) => `rgb(${e.rgb.join(",")})`).join(",")})` }}>
                {reading?.kind === "data" && (
                  <span className="absolute top-0 h-full w-1 -translate-x-1/2 bg-black shadow-[0_0_0_2px_white] transition-[left] duration-200" style={{ left: `${entryPosition(table, reading.entry) * 100}%` }} />
                )}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-glass-muted tabular-nums">
                <span>{table.entries[0] ? Math.round(table.entries[0].lo) : ""} {table.units}</span>
                <span>NASA color bar</span>
                <span>{table.entries.at(-1) ? Math.round(table.entries.at(-1)!.hi) : ""} {table.units}</span>
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setEngineView(!engineView)} aria-pressed={engineView}
          className="glass-light flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold">
          {engineView ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {engineView ? "Show the original image" : "See what the engine ignores"}
        </button>

        {share && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/5 p-3"><dt className="text-[11px] uppercase tracking-widest text-glass-muted">Data</dt><dd className="font-display text-3xl">{Math.round(share.data * 100)}%</dd></div>
            <div className="rounded-lg bg-white/5 p-3"><dt className="text-[11px] uppercase tracking-widest text-glass-muted">Logo, date</dt><dd className="font-display text-3xl text-amber-200">{Math.round(share.masked * 100)}%</dd></div>
            <div className="rounded-lg bg-white/5 p-3"><dt className="text-[11px] uppercase tracking-widest text-glass-muted">Not data</dt><dd className="font-display text-3xl text-glass-muted">{Math.round(share.none * 100)}%</dd></div>
          </dl>
        )}
      </div>
    </div>
  );
}
