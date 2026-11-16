"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Aparece (fundido y subida) cuando entra en pantalla. `onShow` avisa la primera
 * vez, para arrancar animaciones solo cuando alguien las ve.
 */
export function Reveal({ children, className = "", onShow }: { children: ReactNode; className?: string; onShow?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const notify = useRef(onShow);

  useEffect(() => {
    notify.current = onShow;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          notify.current?.();
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`transition-[opacity,translate] duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${className}`}>
      {children}
    </div>
  );
}
