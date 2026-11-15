"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AudioWaveform, BookOpen, House, Satellite, Smile, Users, Workflow } from "lucide-react";
import { useMascot } from "@/components/mascot/mascot-context";
import { useVoice } from "@/components/voice/voice-context";
import { VoiceSettings } from "@/components/voice/voice-settings";

/** Rutas principales del sitio. Añade aquí nuevas secciones (con su icono para la barra móvil). */
export const NAV_LINKS = [
  { href: "/", label: "Home", icon: House },
  { href: "/how-it-works", label: "How it works", icon: Workflow },
  { href: "/nasa-data", label: "NASA Data", icon: Satellite },
  { href: "/references", label: "References", icon: BookOpen },
  { href: "/our-team", label: "Our Team", icon: Users },
] as const;

const LINK_BASE =
  "relative block whitespace-nowrap py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-white after:transition-transform after:duration-300";
const LINK_ON = "text-white after:scale-x-100";
const LINK_OFF = "text-white/55 hover:text-white after:scale-x-0";

/** Botones de icono de la barra móvil. */
const ICON_BASE =
  "relative grid size-8 place-items-center rounded-xl transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-400 min-[420px]:size-9";
const ICON_ON = "text-white";
const ICON_OFF = "text-white/55 hover:bg-white/5 hover:text-white";
const ICON_SVG = "size-[18px]";

/**
 * Barra superior fija, de lado a lado, con el logo a la izquierda y los enlaces a la derecha.
 * En móvil los enlaces de texto se sustituyen por una pastilla de iconos.
 *
 * En rutas dinámicas la ruta actual solo se conoce al pedir la página, así que el
 * enlace activo se resuelve dentro de un `<Suspense>`; mientras tanto se muestra
 * la misma barra sin enlace activo.
 */
export function SiteNav() {
  return (
    <Suspense fallback={<SiteNavBar pathname={null} />}>
      <CurrentSiteNav />
    </Suspense>
  );
}

function CurrentSiteNav() {
  return <SiteNavBar pathname={usePathname()} />;
}

function SiteNavBar({ pathname }: { pathname: string | null }) {
  const mascot = useMascot();
  const voice = useVoice();

  return (
    <header data-voice-section="Top navigation bar" className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/45 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 md:gap-6 md:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Earth Jukebox — Home">
          <AudioWaveform className="h-5 w-5 text-teal-400" aria-hidden />
          {/* En pantallas muy estrechas solo queda el icono, para no chocar con la barra de iconos */}
          <span className="hidden text-sm font-bold uppercase tracking-[0.18em] min-[380px]:inline">Earth</span>
          <span className="hidden text-sm font-light text-glass-muted sm:inline">Jukebox</span>
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 overflow-x-auto [scrollbar-width:none] md:block">
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
                Mascot
              </button>
            </li>
            {/* Selector de la guía por voz (Off · Full guide) */}
            <li>
              <VoiceSettings variant="nav" className={`${LINK_BASE} ${voice.enabled ? LINK_ON : LINK_OFF}`} />
            </li>
          </ul>
        </nav>

        <MobileNav pathname={pathname} />
      </div>
    </header>
  );
}

/**
 * Pastilla de iconos que sustituye a los enlaces de texto en móvil. Un punto con el
 * color de acento de la página marca la sección actual.
 *
 * Sin `backdrop-filter` propio: así el panel `fixed` de la voz se sigue colocando
 * respecto a la barra superior y no respecto a la pastilla.
 */
function MobileNav({ pathname }: { pathname: string | null }) {
  const mascot = useMascot();
  const voice = useVoice();

  return (
    <nav aria-label="Main" data-voice-section="Main navigation" className="ml-auto min-w-0 md:hidden">
      <ul className="flex items-center rounded-2xl border border-white/10 bg-linear-to-br from-white/9 to-white/2 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-10px_rgba(0,0,0,0.7)]">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                title={label}
                aria-current={active ? "page" : undefined}
                className={`${ICON_BASE} ${active ? ICON_ON : ICON_OFF}`}
              >
                <Icon aria-hidden className={ICON_SVG} strokeWidth={active ? 2 : 1.75} />
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 transition-[scale,opacity] duration-300 starting:scale-0 starting:opacity-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--accent,#2dd4bf)] shadow-[0_0_8px_var(--accent,#2dd4bf)]"
                  />
                )}
              </Link>
            </li>
          );
        })}

        <li aria-hidden className="mx-1 h-5 w-px bg-white/15" />

        <li>
          <button
            type="button"
            onClick={mascot.toggle}
            aria-pressed={mascot.visible}
            aria-label="Mascot"
            title="Mascot"
            className={`${ICON_BASE} ${mascot.visible ? ICON_ON : ICON_OFF}`}
          >
            <Smile aria-hidden className={ICON_SVG} strokeWidth={1.75} />
          </button>
        </li>
        <li>
          <VoiceSettings variant="compact" className={`${ICON_BASE} ${voice.enabled ? ICON_ON : ICON_OFF}`} />
        </li>
      </ul>
    </nav>
  );
}
