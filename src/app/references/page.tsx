import type { Metadata } from "next";
import {
  ArrowUpRight,
  Container,
  Database,
  Github,
  Library,
  Map as MapIcon,
  Music,
  Palette,
  Satellite,
  Server,
  Speech,
  SquareArrowOutUpRight,
  Type,
  type LucideIcon,
} from "lucide-react";
import { ExternalLink } from "@/components/external-link";
import { PageShell } from "@/components/page-shell";
import { EXTERNAL_SERVICES, OWN_API, REPOS, STACK, type ExternalService, type ServiceIcon } from "@/lib/references";

export const metadata: Metadata = {
  title: "References — Earth Jukebox",
  description: "The APIs, services and technologies behind Earth Jukebox, front end and back end.",
};

const ICONS: Record<ServiceIcon, LucideIcon> = {
  satellite: Satellite,
  palette: Palette,
  library: Library,
  map: MapIcon,
  speech: Speech,
  music: Music,
  type: Type,
  database: Database,
  container: Container,
};

const CARD = "rounded-2xl border border-white/10 bg-black/45 backdrop-blur-xl";

export default function ReferencesPage() {
  return (
    <PageShell>
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-widest text-glass-muted">References</p>
        <h1 className="mt-4 bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text font-display text-5xl leading-none text-transparent md:text-7xl">
          APIs &amp; Services
        </h1>
        <p className="mt-6 text-lg text-glass-muted">
          The platforms and services Earth Jukebox relies on, from NASA&apos;s visualizations to the API that serves them.
        </p>
      </header>

      <section aria-labelledby="services" data-voice-section="APIs and services" className="mt-14">
        <h2 id="services" className="sr-only">External APIs and services</h2>
        <ul className="grid gap-5 md:grid-cols-2">
          {EXTERNAL_SERVICES.map((service) => (
            <li key={service.name} className="flex">
              <ServiceCard service={service} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="own-api" data-voice-section="Our backend" className="mt-20 scroll-mt-28">
        <SectionTitle id="own-api" eyebrow="Backend">Our own API</SectionTitle>
        <article className={`${CARD} mt-8 grid gap-8 p-6 md:grid-cols-[1fr_1.2fr] md:p-8`}>
          <div>
            <div className="flex items-center gap-3">
              <IconBubble icon={Server} />
              <div>
                <h3 className="text-lg font-semibold">{OWN_API.name}</h3>
                <span className="mt-1 inline-block rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-black">REST API</span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-glass-muted">{OWN_API.description}</p>
            <UsesList uses={OWN_API.uses} />
          </div>

          <div>
            <p className="text-sm font-semibold">Endpoints used by the front</p>
            <ul className="mt-3 space-y-2">
              {OWN_API.endpoints.map((e) => (
                <li key={e.path} className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 font-semibold text-emerald-300">{e.method}</span>
                    <span className="break-all">{e.path}</span>
                  </p>
                  <p className="mt-1.5 text-xs text-glass-muted">{e.use}</p>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section aria-labelledby="stack" data-voice-section="Technology stack" className="mt-20 scroll-mt-28">
        <SectionTitle id="stack" eyebrow="Built with">Technology stack</SectionTitle>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {STACK.map(({ side, items }) => (
            <div key={side} className={`${CARD} p-6`}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">{side}</h3>
              <ul className="mt-4 divide-y divide-white/5">
                {items.map((item) => (
                  <li key={item.name}>
                    <ExternalLink
                      href={item.href}
                      className="group flex items-center justify-between gap-4 py-2.5 text-sm transition hover:text-emerald-300"
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className="ml-auto text-right text-xs text-glass-muted group-hover:text-glass">{item.role}</span>
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <ul className="mt-5 grid gap-5 md:grid-cols-2">
          {REPOS.map((repo) => (
            <li key={repo.repo} className="flex">
              <RepoCard {...repo} />
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-16 text-center text-xs leading-relaxed text-glass-muted">
        Product and service names belong to their owners. Earth Jukebox is a NASA Space Apps Challenge entry and is not endorsed by NASA.
      </p>
    </PageShell>
  );
}

function ServiceCard({ service: s }: { service: ExternalService }) {
  return (
    <article className={`${CARD} relative flex w-full flex-col p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40`}>
      <ExternalLink
        href={s.href}
        label={`Visit ${s.name}`}
        noArrow
        className="absolute right-5 top-5 rounded-lg p-1.5 text-emerald-400 transition hover:bg-emerald-400/10 hover:text-emerald-300"
      >
        <SquareArrowOutUpRight aria-hidden className="h-4 w-4" />
      </ExternalLink>

      <div className="flex items-start gap-3 pr-8">
        <IconBubble icon={ICONS[s.icon]} />
        <div>
          <h3 className="font-semibold leading-snug">{s.name}</h3>
          <span className="mt-1.5 inline-block rounded-full bg-orange-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white">{s.category}</span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-glass-muted">{s.description}</p>
      <UsesList uses={s.uses} />

      <p className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-[11px] text-glass-muted">
        <span className="uppercase tracking-widest">Used by</span>
        {s.usedBy.map((side) => (
          <span key={side} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-semibold text-glass">
            {side === "Project" ? "Whole project" : side}
          </span>
        ))}
      </p>
    </article>
  );
}

function RepoCard({ side, repo, description }: (typeof REPOS)[number]) {
  const [owner, name] = repo.split("/");
  return (
    <ExternalLink
      href={`https://github.com/${repo}`}
      label={`${side} repository on GitHub`}
      noArrow
      className={`${CARD} group relative flex w-full items-center gap-4 overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-400/10 via-transparent to-teal-400/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 transition-colors duration-300 group-hover:border-emerald-400/40 group-hover:bg-emerald-400/10"
      >
        <Github className="h-5 w-5 text-glass transition-colors group-hover:text-emerald-300" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">{side} repository</span>
        <span className="mt-1 block truncate font-mono text-sm font-semibold">
          <span className="text-glass-muted">{owner}/</span>
          {name}
        </span>
        <span className="mt-1 block text-xs text-glass-muted">{description}</span>
      </span>
      <ArrowUpRight
        aria-hidden
        className="relative h-5 w-5 shrink-0 text-glass-muted transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-300"
      />
    </ExternalLink>
  );
}

function IconBubble({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5">
      <Icon className="h-[18px] w-[18px] text-glass" />
    </span>
  );
}

function UsesList({ uses }: { uses: string[] }) {
  return (
    <>
      <p className="mt-5 text-sm font-semibold">Uses in the project:</p>
      <ul className="mt-2 space-y-1.5">
        {uses.map((use) => (
          <li key={use} className="flex gap-2.5 text-sm leading-relaxed text-glass-muted">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            {use}
          </li>
        ))}
      </ul>
    </>
  );
}

function SectionTitle({ id, eyebrow, children }: { id: string; eyebrow: string; children: string }) {
  return (
    <header className="text-center">
      <p className="text-xs uppercase tracking-widest text-emerald-300/90">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-4xl leading-none md:text-5xl">{children}</h2>
    </header>
  );
}
