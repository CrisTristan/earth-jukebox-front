import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { CoverSkeleton } from "@/components/cover-image";
import { PageShell } from "@/components/page-shell";
import { TrackPlayer } from "@/components/player/track-player";
import { getPlaylist, getTrack } from "@/lib/api/client";
import type { PlaylistDetail, TrackDetail } from "@/lib/api/types";
import { toPlayerData } from "@/lib/player";
import { bgStyle } from "@/lib/theme";

export default function TrackPage({ params }: PageProps<"/playlists/[slug]/[track]">) {
  return (
    <Suspense fallback={<PlayerSkeleton />}>
      <TrackLoader params={params} />
    </Suspense>
  );
}

async function TrackLoader({ params }: { params: Promise<{ slug: string; track: string }> }) {
  const { slug, track: trackSlug } = await params;
  let playlist: PlaylistDetail | null;
  let track: TrackDetail | null;
  try {
    [playlist, track] = await Promise.all([getPlaylist(slug), getTrack(trackSlug)]);
  } catch (error) {
    return <PageShell><ApiErrorNotice error={error} title="Couldn't load this track" /></PageShell>;
  }
  if (!playlist || !track || track.playlist_id !== playlist.id) notFound();

  return <TrackPlayer key={track.slug} data={toPlayerData(playlist, track)} />;
}

function PlayerSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden" aria-busy="true" aria-label="Loading track">
      <div className="jb-bg" style={bgStyle} />
      <div className="flex h-screen flex-col gap-4 p-4">
        <div className="flex min-h-0 flex-1 gap-4">
          <CoverSkeleton className="hidden md:block w-1/4 max-w-xs rounded-3xl" />
          <CoverSkeleton className="flex-1 rounded-3xl" />
        </div>
        <CoverSkeleton className="h-[10vh] min-h-20 rounded-3xl" />
      </div>
    </div>
  );
}
