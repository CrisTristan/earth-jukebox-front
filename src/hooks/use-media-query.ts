"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Móvil en horizontal. Igual que el variant `land:` de `src/app/globals.css`. */
export const MOBILE_LANDSCAPE = "(orientation: landscape) and (max-height: 540px)";

/** `true` mientras el media query se cumple (en el servidor, siempre `false`). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
