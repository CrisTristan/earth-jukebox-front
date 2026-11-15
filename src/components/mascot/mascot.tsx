"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useMascot } from "@/components/mascot/mascot-context";

// Provisional: por ahora la mascota sólo saluda
const GREETING = "Hi! I'm the Earth Jukebox mascot. Soon I'll tell you what you're listening to.";

function MascotDock() {
  const [greeting, setGreeting] = useState(false);

  useEffect(() => {
    if (!greeting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGreeting(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [greeting]);

  return (
    // Fija al viewport (no la afecta el scroll) y por encima de todo el contenido.
    // Sin tapar nada: sólo la mascota y el globo reciben clics.
    <div data-voice-section="Mascot" className="pointer-events-none fixed bottom-4 right-0 z-50 flex flex-col items-end gap-3 px-5 md:bottom-6 md:px-8 lg:px-10">
      <div
        id="mascot-greeting"
        hidden={!greeting}
        className="glass-strong pointer-events-auto max-w-64 rounded-2xl p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400">Mascot</p>
        <p className="mt-2 text-sm leading-relaxed text-glass-muted">{GREETING}</p>
      </div>

      <button
        type="button"
        onClick={() => setGreeting((open) => !open)}
        aria-expanded={greeting}
        aria-controls="mascot-greeting"
        aria-label={greeting ? "Hide the mascot's greeting" : "Say hi to the mascot"}
        className="pointer-events-auto rounded-full transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400"
      >
        <Image
          src="/mascot/mascot.gif"
          alt=""
          width={640}
          height={640}
          // El optimizador convertiría el GIF en un fotograma fijo y perdería la animación
          unoptimized
          className="size-24 drop-shadow-[0_0_20px_rgba(11,15,20,0.8)] md:size-28"
        />
      </button>
    </div>
  );
}

// Apagarla desmonta el globo, así que vuelve siempre cerrada
export function Mascot() {
  return useMascot().visible ? <MascotDock /> : null;
}
