import type { ReactNode } from "react";
import { Mascot } from "@/components/mascot/mascot";
import { SiteNav } from "@/components/site-nav";
import { HOVER_THEME_CSS, themeStyle } from "@/lib/theme";

interface PageShellProps {
  children: ReactNode;
  /** Fondo que se resuelve aparte (p. ej. el de una playlist) y se pinta sobre el de por defecto. */
  background?: ReactNode;
}

/** Fondo, barra de navegación y mascota comunes a las páginas del sitio. */
export function PageShell({ children, background }: PageShellProps) {
  return (
    <div className="relative min-h-screen font-sans text-glass overflow-hidden" style={themeStyle()}>
      <style href="jb-hover-themes" precedence="default">{HOVER_THEME_CSS}</style>
      <div className="jb-bg" />
      {background}
      <SiteNav />
      <main data-voice-section="Main content" className="jb-enter mx-auto max-w-6xl px-6 pt-32 pb-16 md:pt-40 md:pb-24">{children}</main>
      <Mascot />
    </div>
  );
}

/**
 * Capa de fondo con los colores de un perfil. Las variables van en el contenedor
 * para que el hover sobre una playlist o un track pueda sobrescribirlas.
 */
export function ThemedBackground({ profile }: { profile: string | null }) {
  if (!profile) return null;
  return (
    <div style={themeStyle(profile)}>
      <div className="jb-bg" />
    </div>
  );
}
