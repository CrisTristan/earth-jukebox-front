import { LoaderCircle } from "lucide-react";

/** Aviso de carga: icono girando y texto, anunciado a los lectores de pantalla. */
export function LoadingSpinner({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p role="status" aria-live="polite" className={`glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-glass-muted ${className}`}>
      <LoaderCircle aria-hidden className="h-4 w-4 motion-safe:animate-spin" /> {label}
    </p>
  );
}
