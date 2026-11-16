import type { Metadata } from "next";
import Image from "next/image";
import { Github } from "lucide-react";
import { ExternalLink } from "@/components/external-link";
import { SectionPage } from "@/components/section-page";

export const metadata: Metadata = {
  title: "Our Team — Earth Jukebox",
  description: "The people behind Earth Jukebox.",
};

// Fotos en public/team_members
const TEAM_MEMBERS = [
  { name: "Cristian Abad", role: "Front-end Programming", photo: "/team_members/cris_abad.jpg", github: "CrisTristan" },
  { name: "Hector", role: "Security", photo: "/team_members/hector.jpg", github: "hharieta" },
  { name: "Ian Diaz", role: "Frame Conversion & REST API", photo: "/team_members/ian.jpg", github: "IanDiaz05" },
  { name: "Juan", role: "Image Transformation Engine", photo: "/team_members/juan.jpeg", github: "juan-shmonk" },
  { name: "Rafael Sosa", role: "Dataset Extraction &   Sonification", photo: "/team_members/rafael.jpg", github: "RAFAEL-SOSA-UH" },
  { name: "Thao", role: "Front-end & Mascot Design", photo: "/team_members/tao.jpg", github: "Meomusie29" },
];

export default function OurTeamPage() {
  return (
    <SectionPage
      eyebrow="People"
      title="Our Team"
      intro="The people behind Earth Jukebox."
    >
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {TEAM_MEMBERS.map((member) => (
          <li key={member.photo} className="group glass overflow-hidden rounded-3xl">
            <div className="relative aspect-square w-full overflow-hidden">
              <Image
                src={member.photo}
                alt={`Photo of ${member.name}`}
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/40 to-transparent" />
            </div>
            <div className="p-5">
              <p className="font-display text-2xl leading-tight">{member.name}</p>
              <span aria-hidden className="mt-3 block h-px w-10 bg-white/30" />
              <p className="mt-3 text-xs uppercase leading-relaxed tracking-widest text-glass-muted">
                {member.role}
              </p>
              <hr className="my-4 border-white/15" />
              <ExternalLink
                href={`https://github.com/${member.github}`}
                label={`${member.name} on GitHub`}
                noArrow
                className="inline-flex max-w-full items-center gap-2 rounded-full text-sm text-glass-muted transition hover:text-glass focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <Github aria-hidden className="h-5 w-5 shrink-0" />
                <span className="truncate">@{member.github}</span>
              </ExternalLink>
            </div>
          </li>
        ))}
      </ul>
    </SectionPage>
  );
}
