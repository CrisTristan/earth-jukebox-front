import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

interface ExternalLinkProps {
  href: string;
  className?: string;
  /** Texto para lectores de pantalla cuando el enlace solo muestra un icono. */
  label?: string;
  /** Oculta la flecha final (p. ej. si el enlace ya es un icono). */
  noArrow?: boolean;
  children?: ReactNode;
}

/** Enlace externo: se abre en otra pestaña y lo anuncia a lectores de pantalla. */
export function ExternalLink({ href, className, label, noArrow, children }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label ? `${label} (opens in a new tab)` : undefined} className={className}>
      {children}
      {!label && <span className="sr-only"> (opens in a new tab)</span>}
      {!noArrow && <ArrowUpRight aria-hidden className="inline h-3.5 w-3.5 shrink-0" />}
    </a>
  );
}
