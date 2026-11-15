import type { CSSProperties } from "react";

/** Gradiente de fondo animado (`.jb-bg`) común a todas las páginas. */
export const BG_GRADIENT = ["oklch(0.18 0.05 250)", "oklch(0.42 0.11 230)", "oklch(0.55 0.09 200)"] as const;

export const bgStyle = { "--g1": BG_GRADIENT[0], "--g2": BG_GRADIENT[1], "--g3": BG_GRADIENT[2] } as CSSProperties;
