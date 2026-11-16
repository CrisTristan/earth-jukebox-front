import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Globe } from "lucide-react";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { CoverSkeleton } from "@/components/cover-image";
import { GlobePlayer } from "@/components/globe/globe-player";
import { PageShell } from "@/components/page-shell";
import { getPlaylist, getTrack } from "@/lib/api/client";
import type { PlaylistDetail, TrackDetail } from "@/lib/api/types";
import { toGlobeData } from "@/lib/globe/data";
import { GLOBE_ROOT, isGlobeTrack } from "@/lib/globe/routes";

export const metadata: Metadata = {
  title: "Inside the globe — Earth Jukebox",
  description: "A NASA timelapse wrapped around you, seen from the center of the Earth.",
};

export default function GlobeTrackPage({ params }: PageProps<"/globo/[slug]/[track]">) {
  return (
    <Suspense fallback={<GlobeSkeleton />}>
      <GlobeLoader params={params} />
    </Suspense>
  );
}

async function GlobeLoader({ params }: { params: Promise<{ slug: string; track: string }> }) {
  const { slug, track: trackSlug } = await params;
  let playlist: PlaylistDetail | null;
  let track: TrackDetail | null;
  try {
    [playlist, track] = await Promise.all([getPlaylist(slug), getTrack(trackSlug)]);
  } catch (error) {
    return <PageShell><ApiErrorNotice error={error} title="Couldn't load this timelapse" /></PageShell>;
  }
  if (!playlist || !track || track.playlist_id !== playlist.id) notFound();

  if (!isGlobeTrack(track)) {
    const playerHref = `/playlists/${encodeURIComponent(playlist.slug)}/${encodeURIComponent(track.slug)}`;
    return (
      <PageShell>
        <div role="status" className="glass max-w-xl rounded-3xl p-6">
          <Globe aria-hidden className="h-6 w-6 text-glass-muted" />
          <h1 className="mt-4 font-display text-3xl leading-tight">{track.title} is already a globe</h1>
          <p className="mt-2 text-sm leading-relaxed text-glass-muted">
            Its frames show the Earth from the outside, so they can&apos;t be wrapped around you. Watch it in the player instead.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={playerHref} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-105">
              Open in player
            </Link>
            <Link href={GLOBE_ROOT} className="glass-light inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
              <ArrowLeft aria-hidden className="h-4 w-4" /> All globes
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return <GlobePlayer key={track.slug} data={toGlobeData(playlist, track)} />;
}

function GlobeSkeleton() {
  return (
    <div className="fixed inset-0 bg-black" aria-busy="true" aria-label="Loading the globe">
      <CoverSkeleton className="absolute inset-x-3 bottom-3 h-36 rounded-3xl md:inset-x-auto md:left-1/2 md:w-[48rem] md:-translate-x-1/2" />
    </div>
  );
}
