"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform } from "lucide-react";
import { useMascot } from "@/components/mascot/mascot-context";

/** Rutas principales del sitio. Añade aquí nuevas secciones. */
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/nasa-data", label: "NASA Data" },
  { href: "/our-team", label: "Our Team" },
] as const;

const LINK_BASE =
  "relative block whitespace-nowrap py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-white after:transition-transform after:duration-300";
const LINK_ON = "text-white after:scale-x-100";
const LINK_OFF = "text-white/55 hover:text-white after:scale-x-0";

/** Barra superior fija, de lado a lado, con el logo a la izquierda y los enlaces a la derecha. */
export function SiteNav() {
  const pathname = usePathname();
  const mascot = useMascot();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/45 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-6 px-4 md:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Earth Jukebox — Home">
          <AudioWaveform className="h-5 w-5 text-teal-400" aria-hidden />
          <span className="text-sm font-bold uppercase tracking-[0.18em]">Earth</span>
          <span className="hidden text-sm font-light text-glass-muted sm:inline">Jukebox</span>
        </Link>

        <nav aria-label="Main" className="min-w-0 overflow-x-auto [scrollbar-width:none]">
          <ul className="flex items-center gap-5 md:gap-10">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`${LINK_BASE} ${active ? LINK_ON : LINK_OFF}`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            {/* Interruptor (no es una ruta): muestra u oculta la mascota */}
            <li>
              <button
                type="button"
                onClick={mascot.toggle}
                aria-pressed={mascot.visible}
                className={`${LINK_BASE} ${mascot.visible ? LINK_ON : LINK_OFF}`}
              >
                Mascota
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
