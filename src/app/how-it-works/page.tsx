import type { Metadata } from "next";
import { PlaceholderCard, SectionPage } from "@/components/section-page";

export const metadata: Metadata = {
  title: "How it works — Earth Jukebox",
  description: "How Earth Jukebox turns NASA imagery into sound.",
};

// TODO: reemplazar los marcadores con la explicación real del pipeline.
export default function HowItWorksPage() {
  return (
    <SectionPage
      eyebrow="Process"
      title="How it works"
      intro="From satellite image to soundscape: the steps behind Earth Jukebox."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <PlaceholderCard title="1. Capture">NASA imagery input — coming soon.</PlaceholderCard>
        <PlaceholderCard title="2. Analyze">CNN feature extraction — coming soon.</PlaceholderCard>
        <PlaceholderCard title="3. Sonify">Mapping features to sound — coming soon.</PlaceholderCard>
      </div>
    </SectionPage>
  );
}
