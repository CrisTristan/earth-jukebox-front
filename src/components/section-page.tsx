import type { ReactNode } from "react";
import { Mascot } from "@/components/mascot/mascot";
import { SiteNav } from "@/components/site-nav";
import { EPIC_DATASET as DS } from "@/lib/datasets";

interface SectionPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  children?: ReactNode;
}

/** Contenedor común para las secciones secundarias (How it works, NASA Data, Our Team). */
export function SectionPage({ eyebrow, title, intro, children }: SectionPageProps) {
  const bg = { "--g1": DS.gradient[0], "--g2": DS.gradient[1], "--g3": DS.gradient[2] } as React.CSSProperties;

  return (
    <div className="relative min-h-screen font-sans text-glass overflow-hidden">
      <div className="jb-bg" style={bg} />
      <SiteNav />
      <main className="jb-enter mx-auto max-w-6xl px-6 pt-32 pb-16 md:pt-40 md:pb-24">
        <p className="text-xs uppercase tracking-widest text-glass-muted">{eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl md:text-7xl leading-none">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg text-glass-muted">{intro}</p>
        <div className="mt-12">{children}</div>
      </main>
      <Mascot />
    </div>
  );
}

/** Tarjeta de marcador de posición para contenido pendiente. */
export function PlaceholderCard({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="glass rounded-3xl p-6">
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-glass-muted">{children ?? "Coming soon."}</p>
    </div>
  );
}
