import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { PlaylistGrid, PlaylistGridSkeleton } from "@/components/playlists/playlist-grid";

export default function Home() {
  return (
    <PageShell>
      <p className="flex items-center gap-3 font-display text-lg italic text-white/85 md:text-xl">
        <span aria-hidden className="h-px w-8 bg-[var(--accent)] transition-colors duration-1000" />
        NASA Space Apps Challenge 2026
      </p>
      <h1 className="mt-6 font-display text-6xl md:text-8xl leading-none">Earth Jukebox</h1>
      <p className="mt-6 max-w-xl text-lg text-glass-muted">
        Translating NASA&apos;s Earth Information Center visual data into dynamic soundscapes.
      </p>
      <h2 className="mt-16 mb-6 text-sm uppercase tracking-widest text-glass-muted">Playlists</h2>
      <Suspense fallback={<PlaylistGridSkeleton />}>
        <PlaylistGrid />
      </Suspense>
    </PageShell>
  );
}
