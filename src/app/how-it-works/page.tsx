import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { GridReveal } from "@/components/how/grid-reveal";
import { PaletteBoard } from "@/components/how/palette-board";
import { PixelProbe } from "@/components/how/pixel-probe";
import { RadarDemo } from "@/components/how/radar-demo";
import { Reveal } from "@/components/how/reveal";
import { SoundDemo } from "@/components/how/sound-demo";
import { SectionPage } from "@/components/section-page";
import { SectionTabs } from "@/components/section-tabs";
import { getPlaylist, getTrack } from "@/lib/api/client";
import { toPlayerData } from "@/lib/player";
import { PLAYER_SHORTCUTS } from "@/lib/shortcuts";

export const metadata: Metadata = {
  title: "How it works — Earth Jukebox",
  description: "How Earth Jukebox reads NASA imagery pixel by pixel and turns the numbers into music you can explore.",
};

/** La página usa un timelapse real de principio a fin: monóxido de carbono (GEOS-CF). */
const PLAYLIST = "air-quality-timelapses";
const TRACK = "geos-co-2026-oct-nov";
const RES = "/data_ingest_resources";
const CO_FRAME = `${RES}/air-quality-carbon-monoxide/frame_000_00000001.webp`;
const CO_TABLE = `${RES}/colormaps/GEOS_CF_CO.xml`;
/** Zonas que el motor ignora en los mapas GEOS (las mismas `mask_boxes` del perfil). */
const GEOS_MASKS = [
  { box: [0, 0, 0.175, 0.075] as const, what: "NASA · GMAO logo" },
  { box: [0, 0.9, 0.25, 1] as const, what: "date and time" },
];

const STEPS = [
  { id: "pixels", label: "Pixels" },
  { id: "numbers", label: "Numbers" },
  { id: "music", label: "Music" },
  { id: "radar", label: "Radar" },
  { id: "instruments", label: "Instruments" },
  { id: "access", label: "Made to be heard" },
] as const;

export default function HowItWorksPage() {
  return (
    <SectionPage
      eyebrow="Process"
      title="How it works"
      intro="Every note you hear was measured from a NASA image. Nothing is pre-recorded for a dataset: our engine reads the colors of each frame, turns them into numbers, and the numbers play the music. Try every step below with real data."
    >
      <SectionTabs items={STEPS} numbered label="Steps" />

      <Step id="pixels" n={1} title="Read every pixel"
        lead="NASA paints its data with a color scale. The engine looks up the color of every pixel in the official color bar and gets back the physical value. Logos and dates are ignored, and so is anything that isn't on the scale, like land, coastlines or text.">
        <PixelProbe image={CO_FRAME} table={CO_TABLE} masks={GEOS_MASKS} />
      </Step>

      <Suspense fallback={<LiveSkeleton />}>
        <LiveSteps />
      </Suspense>

      <Step id="instruments" n={5} title="Every dataset has its own band"
        lead="The rules are the same for every dataset; the sounds are not. Humidity, rain, temperature and vegetation sound like nature. The others play an instrument with a texture that grows with the data. Press a card to hear it.">
        <PaletteBoard />
      </Step>

      <Step id="access" n={6} title="Made to be heard"
        lead="Earth Jukebox is designed so you can explore the planet without seeing it. A voice guide can describe each frame, the map says the name of the place you click, and the radar works with the keyboard alone.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass rounded-lg p-6">
            <p className="text-xs uppercase tracking-widest text-glass-muted">In the player</p>
            <ul className="mt-4 space-y-2 text-sm">
              {PLAYER_SHORTCUTS.map(([k, v]) => (
                <li key={k} className="flex gap-3"><kbd className="w-14 shrink-0 font-semibold">{k}</kbd><span className="text-glass-muted">{v}</span></li>
              ))}
            </ul>
          </div>
          <div className="glass flex flex-col justify-between gap-6 rounded-lg p-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-glass-muted">Built for ears first</p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-glass-muted">
                <li><span className="font-semibold text-glass">Sound carries the data:</span> pitch, loudness, texture and left–right position each follow a number from the image.</li>
                <li><span className="font-semibold text-glass">Every control has a name</span> for screen readers, and the radar announces where it is when you stop moving it.</li>
                <li><span className="font-semibold text-glass">Silence means no data,</span> so you can hear where the map is empty.</li>
              </ul>
            </div>
            <Link href="/" className="flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-105">
              Start listening <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Step>
    </SectionPage>
  );
}

/** Pasos 2–4: necesitan las medidas reales del timelapse (API). */
async function LiveSteps() {
  let data;
  try {
    const [playlist, track] = await Promise.all([getPlaylist(PLAYLIST), getTrack(TRACK)]);
    if (!playlist || !track) throw new Error("The example timelapse was not found.");
    data = toPlayerData(playlist, track);
  } catch (error) {
    return <div className="mt-24"><ApiErrorNotice error={error} title="Couldn't load the live example" /></div>;
  }
  const first = data.frames[0]!;
  const f = first.features;
  const cuts = (data.dataBands?.cuts ?? [130, 200]) as number[];
  const unit = data.track.unit ?? "";
  const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  return (
    <>
      <Step id="numbers" n={2} title="Summarize the frame"
        lead="Millions of values become a few numbers. The engine averages the map into a 24 × 48 grid and measures what matters: the average, how much of the map is above each threshold, the highest values and where the data is centered.">
        <GridReveal image={first.url} grid={first.grid ?? []} table={CO_TABLE} unit={unit} cuts={[cuts[0] ?? 130, cuts[1] ?? 200]}
          numbers={{ mean: num(f.mean), dense: num(f.frac_high), elevated: num(f.frac_elevated), p95: num(f.p95), lat: num(f.centroid_lat), lon: num(f.centroid_lon) }} />
      </Step>

      <Step id="music" n={3} title="Turn the numbers into music"
        lead={`Each number drives one part of the sound. Press play to hear ${data.frames.length} real frames of carbon monoxide: watch the note climb when there is more smoke, and the texture thicken where it's dense.`}>
        <SoundDemo
          frames={data.frames.map((fr) => ({ url: fr.url, label: fr.label, features: fr.features }))}
          sound={data.sound}
          words={{ subject: data.track.listening.subject, strong: data.track.listening.strong, secondary: data.track.listening.secondary }}
        />
      </Step>

      <Step id="radar" n={4} title="Explore around a point"
        lead="The radar listens to the map around one point. Its arrow turns and plays what it finds in each direction, so you can hear where the data is stronger without seeing the screen.">
        <RadarDemo image={first.url} grid={first.grid ?? []} scale={data.dataScale} cuts={cuts} />
      </Step>
    </>
  );
}

function Step({ id, n, title, lead, children }: { id: string; n: number; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} data-voice-section={`Step ${n}: ${title}`} className="mt-24 scroll-mt-28 md:mt-32">
      <Reveal>
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
          <p aria-hidden className="font-display text-7xl leading-none text-[var(--accent)] md:text-9xl">{String(n).padStart(2, "0")}</p>
          <div>
            <h2 id={`${id}-title`} className="font-display text-4xl leading-tight md:text-6xl">{title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-glass-muted md:text-lg">{lead}</p>
          </div>
        </div>
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function LiveSkeleton() {
  return (
    <div className="mt-24 space-y-6" aria-busy="true" aria-label="Loading the live example">
      {[0, 1, 2].map((i) => <div key={i} className="glass h-72 animate-pulse rounded-lg" />)}
    </div>
  );
}
