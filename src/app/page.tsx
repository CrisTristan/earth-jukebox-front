import { Suspense } from "react";
import { Satellite } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { PlaylistGrid, PlaylistGridSkeleton } from "@/components/playlists/playlist-grid";

export default function Home() {
  return (
    <PageShell>
      <div className="glass-light inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs tracking-widest uppercase text-glass-muted">
        <Satellite className="h-3.5 w-3.5" /> NASA Space Apps Challenge 2026
      </div>
      <h1 className="mt-8 font-display text-6xl md:text-8xl leading-none">Earth Jukebox</h1>
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
