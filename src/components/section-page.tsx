import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";

interface SectionPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  children?: ReactNode;
}

/** Contenedor común para las secciones secundarias (How it works, NASA Data, Our Team). */
export function SectionPage({ eyebrow, title, intro, children }: SectionPageProps) {
  return (
    <PageShell>
      <p className="text-xs uppercase tracking-widest text-glass-muted">{eyebrow}</p>
      <h1 className="mt-4 font-display text-5xl md:text-7xl leading-none">{title}</h1>
      <p className="mt-6 max-w-2xl text-lg text-glass-muted">{intro}</p>
      <div className="mt-12">{children}</div>
    </PageShell>
  );
}

/** Tarjeta de marcador de posición para contenido pendiente. */
export function PlaceholderCard({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="glass rounded-lg p-6">
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-glass-muted">{children ?? "Coming soon."}</p>
    </div>
  );
}
