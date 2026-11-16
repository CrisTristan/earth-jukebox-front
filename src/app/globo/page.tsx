import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Hand, Smartphone } from "lucide-react";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { CoverImage, CoverSkeleton } from "@/components/cover-image";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SectionPage } from "@/components/section-page";
import { frameUrl } from "@/lib/api/frames";
import { getPlaylist, getPlaylists, getTrack } from "@/lib/api/client";
import type { PlaylistDetail, TrackDetail } from "@/lib/api/types";
import { globePath, isGlobeTrack } from "@/lib/globe/routes";
import { profileFromTrackSlug } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Inside the globe — Earth Jukebox",
  description: "Stand inside the planet and watch NASA timelapses wrap around you.",
};

const COVER = "aspect-[2/1] w-full transition-transform duration-700 group-hover:scale-[1.03]";

export default function GlobePage() {
  return (
    <SectionPage
      eyebrow="Immersive"
      title="Inside the globe"
      intro="Stand at the center of the Earth and watch each timelapse wrap around you, frame by frame."
    >
      <ul className="flex flex-wrap gap-3 text-sm text-glass-muted">
        <li className="glass flex items-center gap-2 rounded-full px-4 py-2">
          <Hand aria-hidden className="h-4 w-4" /> Drag or use the arrow keys to look around
        </li>
        <li className="glass flex items-center gap-2 rounded-full px-4 py-2">
          <Smartphone aria-hidden className="h-4 w-4" /> On a phone, turn on motion and turn around
        </li>
      </ul>
      <div className="mt-12">
        <Suspense fallback={<GlobeListSkeleton />}>
          <GlobeTrackList />
        </Suspense>
      </div>
    </SectionPage>
  );
}

interface Group {
  playlist: PlaylistDetail;
  tracks: TrackDetail[];
  /** Tracks de la playlist que ya son un globo visto desde fuera. */
  skipped: number;
}

/** Tracks de la API cuyos frames son un mapa 2:1, agrupadas por playlist. */
async function GlobeTrackList() {
  let groups: Group[];
  try {
    const summaries = await getPlaylists();
    const playlists = (await Promise.all(summaries.map((p) => getPlaylist(p.slug)))).filter((p) => p !== null);
    groups = await Promise.all(
      playlists.map(async (playlist) => {
        const ordered = [...playlist.tracks].sort((a, b) => a.sequence_order - b.sequence_order);
        const details = (await Promise.all(ordered.map((t) => getTrack(t.slug)))).filter((t) => t !== null);
        const tracks = details.filter(isGlobeTrack);
        return { playlist, tracks, skipped: details.length - tracks.length };
      }),
    );
  } catch (error) {
    return <ApiErrorNotice error={error} title="Couldn't load the timelapses" />;
  }

  const visible = groups.filter((g) => g.tracks.length > 0);
  const skipped = groups.reduce((sum, g) => sum + g.skipped, 0);
  if (visible.length === 0) {
    return <p className="glass rounded-3xl p-6 text-glass-muted">No timelapse can be shown inside the globe yet.</p>;
  }

  return (
    <div data-voice-section="Globe timelapses" className="space-y-14">
      {visible.map(({ playlist, tracks }) => (
        <section key={playlist.slug} aria-labelledby={`globe-${playlist.slug}`}>
          <h2 id={`globe-${playlist.slug}`} className="text-sm uppercase tracking-widest text-glass-muted">{playlist.title}</h2>
          <ul className="mt-5 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => (
              <li key={track.slug}>
                <GlobeTrackCard playlistSlug={playlist.slug} track={track} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {skipped > 0 && (
        <p className="text-sm text-glass-muted">
          {skipped} {skipped === 1 ? "timelapse is" : "timelapses are"} already shown as a globe from the outside, so
          {skipped === 1 ? " it plays" : " they play"} only in the player.
        </p>
      )}
    </div>
  );
}

function GlobeTrackCard({ playlistSlug, track }: { playlistSlug: string; track: TrackDetail }) {
  const frames = [...track.frames].sort((a, b) => a.frame_index - b.frame_index);
  const cover = frames[0] ? frameUrl(track, frames[0].frame_id) : null;
  return (
    <Link
      href={globePath(playlistSlug, track.slug)}
      data-bg-theme={profileFromTrackSlug(track.slug) ?? undefined}
      className="group flex flex-col gap-3 rounded-xl outline-offset-4"
    >
      <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
        <CoverImage src={cover} alt={`First frame of ${track.title}`} className={COVER} />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight">{track.title}</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-glass-muted">{frames.length} frames</p>
        </div>
        <ChevronRight aria-hidden className="mt-2 h-5 w-5 shrink-0 text-glass-muted transition group-hover:translate-x-1 group-hover:text-glass" />
      </div>
    </Link>
  );
}

function GlobeListSkeleton() {
  return (
    <div aria-busy="true">
      <LoadingSpinner label="Loading datasets…" />
      <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <CoverSkeleton className="aspect-[2/1] w-full rounded-xl" />
            <CoverSkeleton className="h-7 w-2/3 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
