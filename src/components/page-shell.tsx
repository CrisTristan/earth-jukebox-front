import type { ReactNode } from "react";
import { Mascot } from "@/components/mascot/mascot";
import { SiteNav } from "@/components/site-nav";
import { bgStyle } from "@/lib/theme";

/** Fondo, barra de navegación y mascota comunes a las páginas del sitio. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen font-sans text-glass overflow-hidden">
      <div className="jb-bg" style={bgStyle} />
      <SiteNav />
      <main data-voice-section="Main content" className="jb-enter mx-auto max-w-6xl px-6 pt-32 pb-16 md:pt-40 md:pb-24">{children}</main>
      <Mascot />
    </div>
  );
}
