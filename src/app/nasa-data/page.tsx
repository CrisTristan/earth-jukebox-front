import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Database, Film, FolderDown, Headphones, Palette, Satellite } from "lucide-react";
import { CoverImage } from "@/components/cover-image";
import { SectionPage } from "@/components/section-page";
import {
  CHALLENGE_RESOURCES,
  DATASET_GROUPS,
  SCALE_KINDS,
  TECHNICAL_RESOURCES,
  type Dataset,
  type ScaleKind,
} from "@/lib/nasa-resources";

export const metadata: Metadata = {
  title: "NASA Data — Earth Jukebox",
  description: "The NASA visualizations and datasets that Earth Jukebox turns into sound.",
};

const ALL_DATASETS = DATASET_GROUPS.flatMap((g) => g.datasets);
const TOTAL_FRAMES = ALL_DATASETS.reduce((sum, d) => sum + d.frames, 0);

const SCALE_STYLE: Record<ScaleKind, string> = {
  official: "border-teal-300/40 bg-teal-300/15 text-teal-200",
  approximate: "border-amber-300/40 bg-amber-300/15 text-amber-200",
  relative: "border-violet-300/40 bg-violet-300/15 text-violet-200",
};

const TECHNICAL_ICONS = [Palette, FolderDown, Film, Palette];

const SECTIONS = [
  ...DATASET_GROUPS.map((g) => ({ id: g.id, label: g.title })),
  { id: "challenge", label: "Challenge resources" },
  { id: "technical", label: "Behind the scenes" },
];

export default function NasaDataPage() {
  return (
    <SectionPage
      eyebrow="Sources"
      title="NASA Data"
      intro="Every sound in Earth Jukebox starts as a NASA visualization. These are the datasets we listen to, where they come from, and the references we used to read their colors."
    >
      {/* Cifras */}
      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat value={ALL_DATASETS.length} label="Datasets in the jukebox" />
        <Stat value={TOTAL_FRAMES} label="Frames measured" />
        <Stat value={2} label="NASA services: SVS and GIBS" />
      </dl>

      {/* Índice */}
      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="glass-light rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest text-glass-muted hover:text-glass">
            {s.label}
          </a>
        ))}
      </nav>

      {/* Cómo leer los valores */}
      <section data-voice-section="How to read the values" aria-labelledby="scales-title" className="glass mt-10 rounded-3xl p-6 md:p-8">
        <h2 id="scales-title" className="font-display text-3xl">How to read the values</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-glass-muted">
          Our engine reads the color of every pixel and turns it into a number using the visualization’s color scale. Not every scale is equally precise, so each dataset is labeled with how its values should be read.
        </p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {(Object.keys(SCALE_KINDS) as ScaleKind[]).map((kind) => (
            <li key={kind} className="rounded-2xl bg-white/5 p-4">
              <ScaleBadge kind={kind} />
              <p className="mt-3 text-sm leading-relaxed text-glass-muted">{SCALE_KINDS[kind].description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Datasets por grupo */}
      {DATASET_GROUPS.map((group) => (
        <section key={group.id} id={group.id} data-voice-section={`Datasets: ${group.title}`} aria-labelledby={`${group.id}-title`} className="mt-20 scroll-mt-28">
          <SectionHeading eyebrow={group.provider} title={group.title} id={`${group.id}-title`}>
            {group.intro}
          </SectionHeading>
          <ul className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {group.datasets.map((d) => (
              <li key={d.title} className="flex">
                <DatasetCard dataset={d} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Recursos del reto */}
      <section id="challenge" data-voice-section="Challenge resources" aria-labelledby="challenge-title" className="mt-24 scroll-mt-28">
        <SectionHeading eyebrow="NASA Space Apps Challenge 2026 · Earth Information Center" title="Challenge resources" id="challenge-title">
          The starting point: the visualizations and references the challenge shared from NASA’s Earth Information Center.
        </SectionHeading>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHALLENGE_RESOURCES.map((r, i) => (
            <li key={r.href} className="flex">
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-light group flex w-full items-start gap-4 rounded-2xl p-4"
              >
                <span aria-hidden className="font-display text-2xl leading-none text-teal-300/80 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug">{r.label}</span>
                  <span className="mt-1 block truncate text-xs text-glass-muted">{new URL(r.href).hostname}</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </span>
                <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 text-glass-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-glass" />
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* Material técnico */}
      <section id="technical" data-voice-section="Behind the scenes" aria-labelledby="technical-title" className="mt-24 scroll-mt-28">
        <SectionHeading eyebrow="For the curious" title="Behind the scenes" id="technical-title">
          The raw material behind each track: the exact frames and videos we downloaded, and the color bars and tables we used to turn colors into numbers.
        </SectionHeading>
        <div className="mt-8 space-y-3">
          {TECHNICAL_RESOURCES.map((group, i) => {
            const Icon = TECHNICAL_ICONS[i] ?? Database;
            return (
              <details key={group.title} className="glass group/details rounded-3xl open:bg-white/[0.12]">
                <summary className="flex cursor-pointer list-none items-center gap-4 rounded-3xl p-5 md:p-6 [&::-webkit-details-marker]:hidden">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10">
                    <Icon aria-hidden className="h-5 w-5 text-teal-300" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{group.title}</span>
                    <span className="block text-sm text-glass-muted">{group.description}</span>
                  </span>
                  <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs tabular-nums text-glass-muted sm:inline">
                    {group.links.length} links
                  </span>
                  <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-glass-muted transition-transform group-open/details:rotate-180" />
                </summary>
                <ul className="grid gap-x-6 gap-y-1 px-5 pb-5 sm:grid-cols-2 md:px-6 md:pb-6 lg:grid-cols-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <ExternalLink href={link.href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-glass-muted hover:bg-white/10 hover:text-glass">
                        {link.label}
                      </ExternalLink>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </section>

      {/* Créditos */}
      <section data-voice-section="Credits" aria-labelledby="credits-title" className="glass-strong mt-24 flex flex-col gap-4 rounded-3xl p-6 md:flex-row md:items-center md:p-8">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-300/15">
          <Satellite aria-hidden className="h-6 w-6 text-teal-300" />
        </span>
        <div>
          <h2 id="credits-title" className="font-semibold">Credits</h2>
          <p className="mt-1 text-sm leading-relaxed text-glass-muted">
            Imagery and data courtesy of the{" "}
            <ExternalLink href="https://svs.gsfc.nasa.gov/" className="text-glass underline decoration-white/30 underline-offset-4 hover:decoration-white">
              NASA Scientific Visualization Studio
            </ExternalLink>{" "}
            and{" "}
            <ExternalLink href="https://gibs.earthdata.nasa.gov/colormaps/v1.3/" className="text-glass underline decoration-white/30 underline-offset-4 hover:decoration-white">
              NASA GIBS
            </ExternalLink>
            . Model fields (GEOS, ECCO2) are estimates, not direct observations. Earth Jukebox is a NASA Space Apps Challenge project and is not endorsed by NASA.
          </p>
        </div>
      </section>
    </SectionPage>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="glass flex flex-col-reverse rounded-3xl p-6">
      <dt className="mt-1 text-sm text-glass-muted">{label}</dt>
      <dd className="font-display text-5xl leading-none tabular-nums">{value}</dd>
    </div>
  );
}

function SectionHeading({ eyebrow, title, id, children }: { eyebrow: string; title: string; id: string; children: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs uppercase tracking-widest text-teal-300/90">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-4xl leading-none md:text-5xl">{title}</h2>
      <p className="mt-4 leading-relaxed text-glass-muted">{children}</p>
    </header>
  );
}

function ScaleBadge({ kind }: { kind: ScaleKind }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${SCALE_STYLE[kind]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {SCALE_KINDS[kind].label}
    </span>
  );
}

function DatasetCard({ dataset: d }: { dataset: Dataset }) {
  return (
    <article className="glass group flex w-full flex-col overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1 hover:bg-white/[0.14]">
      <div className="relative">
        <CoverImage src={d.image} alt={`First frame of ${d.title}`} className="aspect-[2/1] w-full transition duration-500 group-hover:scale-[1.03]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold tabular-nums backdrop-blur">
          {d.frames} frames
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl leading-tight">{d.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-glass-muted">{d.summary}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/5 p-3">
            <dt className="text-[10px] uppercase tracking-widest text-glass-muted">Period</dt>
            <dd className="mt-1 font-semibold leading-snug">{d.period}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <dt className="text-[10px] uppercase tracking-widest text-glass-muted">Scale</dt>
            <dd className="mt-1 font-semibold leading-snug">{d.scale}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <ScaleBadge kind={d.scaleKind} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <Link
            href={d.listen}
            aria-label={`Listen to ${d.title}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-105"
          >
            <Headphones aria-hidden className="h-4 w-4" /> Listen
          </Link>
          <ExternalLink href={d.source.href} className="inline-flex items-center gap-1 text-sm text-glass-muted hover:text-glass">
            {d.source.label}
          </ExternalLink>
        </div>
      </div>
    </article>
  );
}

/** Enlace externo: se abre en otra pestaña y lo anuncia a lectores de pantalla. */
function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
      <ArrowUpRight aria-hidden className="inline h-3.5 w-3.5 shrink-0" />
    </a>
  );
}
