import type { Metadata } from "next";
import { PlaceholderCard, SectionPage } from "@/components/section-page";

export const metadata: Metadata = {
  title: "Our Team — Earth Jukebox",
  description: "The people behind Earth Jukebox.",
};

// TODO: reemplazar los marcadores con los miembros reales del equipo.
export default function OurTeamPage() {
  return (
    <SectionPage
      eyebrow="People"
      title="Our Team"
      intro="The people behind Earth Jukebox."
    >
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <PlaceholderCard key={n} title={`Member ${n}`}>Name, role and links — coming soon.</PlaceholderCard>
        ))}
      </div>
    </SectionPage>
  );
}
