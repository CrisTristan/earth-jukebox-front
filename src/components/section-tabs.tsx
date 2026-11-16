"use client";

import { useEffect, useState } from "react";

export interface SectionTab {
  id: string;
  label: string;
}

/**
 * Índice de una página como pestañas con subrayado (el mismo lenguaje que la barra
 * superior). Al bajar, se subraya la sección que está en pantalla.
 */
export function SectionTabs({ items, numbered = false, label = "On this page" }: { items: readonly SectionTab[]; numbered?: boolean; label?: string }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;
    // La sección activa es la que cruza la franja central de la pantalla.
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className="border-b border-white/12">
      <ul className="-mb-px flex gap-x-7 gap-y-1 overflow-x-auto [scrollbar-width:none]">
        {items.map((item, i) => {
          const on = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a href={`#${item.id}`} aria-current={on ? "location" : undefined}
                className={`block border-b-2 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.18em] transition-colors duration-300 ${on ? "border-[var(--accent)] text-glass" : "border-transparent text-glass-muted hover:text-glass"}`}>
                {numbered && <sup className="mr-1.5 text-[10px] tracking-normal text-[var(--accent)]">{String(i + 1).padStart(2, "0")}</sup>}
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
