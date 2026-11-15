import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Star } from "lucide-react";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { CoverImage, CoverSkeleton } from "@/components/cover-image";
import { getPlaylistCover, getPlaylists } from "@/lib/api/client";
import type { PlaylistSummary } from "@/lib/api/types";

const COVER_CLASS = "aspect-[2/1] w-full rounded-2xl transition-transform duration-700 group-hover:scale-105";

async function PlaylistCover({ playlist }: { playlist: PlaylistSummary }) {
  let src: string | null = null;
  try {
    src = await getPlaylistCover(playlist);
  } catch {
    // sin portada: se muestra el marcador
  }
  return <CoverImage src={src} alt={`Cover of ${playlist.title}`} className={COVER_CLASS} />;
}

function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <Link href={`/playlists/${playlist.slug}`}
      className="glass group flex flex-col gap-4 rounded-3xl p-4 transition-all duration-500 hover:scale-[1.01] hover:bg-white/20">
      <div className="overflow-hidden rounded-2xl">
        <Suspense fallback={<CoverSkeleton className={COVER_CLASS} />}>
          <PlaylistCover playlist={playlist} />
        </Suspense>
      </div>
      <div className="flex items-start justify-between gap-4 px-1 pb-1">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-glass-muted">
            {playlist.category}
            {playlist.is_featured && <Star className="h-3 w-3 fill-current" aria-label="Featured" />}
          </p>
          <p className="mt-1 font-display text-3xl leading-tight">{playlist.title}</p>
          {playlist.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-glass-muted">{playlist.description}</p>
          )}
        </div>
        <ChevronRight className="mt-6 h-5 w-5 shrink-0 text-glass-muted transition group-hover:translate-x-1 group-hover:text-glass" aria-hidden />
      </div>
    </Link>
  );
}

/** Rejilla de playlists de `GET /api/v1/playlists`. */
export async function PlaylistGrid() {
  let playlists: PlaylistSummary[];
  try {
    playlists = await getPlaylists();
  } catch (error) {
    return <ApiErrorNotice error={error} />;
  }

  if (playlists.length === 0) {
    return <p className="glass rounded-3xl p-6 text-glass-muted">No playlists yet.</p>;
  }

  return (
    <div data-voice-section="Playlists list" className="grid gap-4 md:grid-cols-2">
      {playlists.map((p) => (
        <PlaylistCard key={p.id} playlist={p} />
      ))}
    </div>
  );
}

export function PlaylistGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading playlists">
      {[0, 1].map((i) => (
        <div key={i} className="glass flex flex-col gap-4 rounded-3xl p-4">
          <CoverSkeleton className="aspect-[2/1] w-full rounded-2xl" />
          <CoverSkeleton className="mx-1 h-4 w-24 rounded-full" />
          <CoverSkeleton className="mx-1 mb-2 h-8 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  );
}
