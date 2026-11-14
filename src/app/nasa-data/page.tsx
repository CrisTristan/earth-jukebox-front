import type { Metadata } from "next";
import { PlaceholderCard, SectionPage } from "@/components/section-page";

export const metadata: Metadata = {
  title: "NASA Data — Earth Jukebox",
  description: "The NASA datasets used by Earth Jukebox.",
};

// TODO: reemplazar los marcadores con la información de los datasets.
export default function NasaDataPage() {
  return (
    <SectionPage
      eyebrow="Sources"
      title="NASA Data"
      intro="The Earth observation datasets that power the soundscapes."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <PlaceholderCard title="Datasets">Dataset list and descriptions — coming soon.</PlaceholderCard>
        <PlaceholderCard title="Credits & licenses">Attribution for NASA sources — coming soon.</PlaceholderCard>
      </div>
    </SectionPage>
  );
}
