import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { MascotProvider } from "@/components/mascot/mascot-context";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Earth Jukebox — NASA Earth data as sound",
  description: "Translating NASA's Earth Information Center visual data into dynamic soundscapes using CNNs.",
  openGraph: {
    title: "Earth Jukebox",
    description: "Listen to the planet: NASA Earth data turned into soundscapes.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${instrumentSerif.variable} antialiased`}>
      <body>
        <MascotProvider>{children}</MascotProvider>
      </body>
    </html>
  );
}
