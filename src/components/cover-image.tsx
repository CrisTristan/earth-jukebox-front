/* eslint-disable @next/next/no-img-element -- los frames se sirven tal cual desde public/frames */

import { ImageOff } from "lucide-react";

interface CoverImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/** Imagen de un frame, o un marcador si la track no tiene imágenes. */
export function CoverImage({ src, alt, className = "" }: CoverImageProps) {
  if (!src) {
    return (
      <div role="img" aria-label={`${alt} (no image)`} className={`grid place-items-center bg-black/40 text-glass-muted ${className}`}>
        <ImageOff className="h-6 w-6" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`bg-black object-cover ${className}`} />;
}

/** Marcador mientras se resuelve la portada. */
export function CoverSkeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse bg-white/10 ${className}`} />;
}
