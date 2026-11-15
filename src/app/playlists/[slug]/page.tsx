import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { CoverImage, CoverSkeleton } from "@/components/cover-image";
import { PageShell } from "@/components/page-shell";
import { Announce } from "@/components/voice/announce";
import { getPlaylist, getPlaylistCover, getTrackCover } from "@/lib/api/client";
import type { PlaylistDetail, TrackSummary } from "@/lib/api/types";

const TRACK_COVER = "aspect-[2/1] w-28 shrink-0 rounded-xl sm:w-40";
const HERO_COVER = "aspect-[2/1] w-full rounded-3xl md:w-96";

export default function PlaylistPage({ params }: PageProps<"/playlists/[slug]">) {
  return (
    <PageShell>
      <Link href="/" className="glass-light inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> All playlists
      </Link>
      <Suspense fallback={<PlaylistSkeleton />}>
        <PlaylistView params={params} />
      </Suspense>
    </PageShell>
  );
}

async function PlaylistView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let playlist: PlaylistDetail | null;
  try {
    playlist = await getPlaylist(slug);
  } catch (error) {
    return <div className="mt-8"><ApiErrorNotice error={error} /></div>;
  }
  if (!playlist) notFound();

  const tracks = [...playlist.tracks].sort((a, b) => a.sequence_order - b.sequence_order);

  return (
    <>
      <Announce text={playlistAnnouncement(playlist.title, tracks)} />
      <header className="mt-8 flex flex-col gap-6 md:flex-row md:items-end">
        <Suspense fallback={<CoverSkeleton className={HERO_COVER} />}>
          <PlaylistHeroCover playlist={playlist} />
        </Suspense>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-glass-muted">Playlist · {playlist.category}</p>
          <h1 className="mt-2 font-display text-5xl md:text-7xl leading-none">{playlist.title}</h1>
          {playlist.description && <p className="mt-4 max-w-2xl text-glass-muted">{playlist.description}</p>}
          <p className="mt-3 text-sm text-glass-muted">{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</p>
        </div>
      </header>

      <h2 className="mt-14 mb-4 text-sm uppercase tracking-widest text-glass-muted">Tracks</h2>
      {tracks.length === 0 ? (
        <p className="glass rounded-3xl p-6 text-glass-muted">This playlist has no tracks yet.</p>
      ) : (
        <ol data-voice-section="Tracks list" className="space-y-3">
          {tracks.map((track, i) => (
            <li key={track.id}>
              <TrackRow playlistSlug={playlist.slug} track={track} index={i} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Lo que dice la voz al entrar: qué playlist se eligió y qué contiene. */
function playlistAnnouncement(title: string, tracks: TrackSummary[]): string {
  if (tracks.length === 0) return `You selected the playlist ${title}. It doesn't have any tracks yet.`;
  const names = tracks.slice(0, 5).map((t) => t.title);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  const count = tracks.length === 1 ? "one track" : `${tracks.length} tracks`;
  return `You selected the playlist ${title}. It has ${count}: ${list}. Choose a track to start listening.`;
}

async function PlaylistHeroCover({ playlist }: { playlist: PlaylistDetail }) {
  const src = await getPlaylistCover(playlist).catch(() => null);
  return <CoverImage src={src} alt={`Cover of ${playlist.title}`} className={HERO_COVER} />;
}

/** Imagen de la track: su primer frame, de `GET /api/v1/tracks/{slug}`. */
async function TrackCover({ track }: { track: TrackSummary }) {
  const src = await getTrackCover(track).catch(() => null);
  return <CoverImage src={src} alt={`First frame of ${track.title}`} className={TRACK_COVER} />;
}

function TrackRow({ playlistSlug, track, index }: { playlistSlug: string; track: TrackSummary; index: number }) {
  const meta = track.source_metadata;
  const details = [meta.frame_count != null && `${meta.frame_count} frames`, meta.source].filter(Boolean).join(" · ");
  return (
    <Link href={`/playlists/${playlistSlug}/${track.slug}`}
      className="glass group flex items-center gap-4 rounded-3xl p-3 transition hover:bg-white/20 sm:gap-5">
      <span className="hidden w-6 text-center text-sm tabular-nums text-glass-muted sm:block">{index + 1}</span>
      <div className="overflow-hidden rounded-xl">
        <Suspense fallback={<CoverSkeleton className={TRACK_COVER} />}>
          <TrackCover track={track} />
        </Suspense>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{track.title}</p>
        {track.description && <p className="mt-0.5 line-clamp-2 text-sm text-glass-muted">{track.description}</p>}
        {details && <p className="mt-1 truncate text-xs text-glass-muted">{details}</p>}
      </div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-105" aria-hidden>
        <Play className="ml-0.5 h-4 w-4 fill-current" />
      </span>
    </Link>
  );
}

function PlaylistSkeleton() {
  return (
    <div className="mt-8" aria-busy="true" aria-label="Loading playlist">
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <CoverSkeleton className={HERO_COVER} />
        <div className="flex-1 space-y-3">
          <CoverSkeleton className="h-4 w-32 rounded-full" />
          <CoverSkeleton className="h-14 w-2/3 rounded-full" />
        </div>
      </div>
      <div className="mt-14 space-y-3">
        {[0, 1, 2].map((i) => <CoverSkeleton key={i} className="h-24 rounded-3xl" />)}
      </div>
    </div>
  );
}
