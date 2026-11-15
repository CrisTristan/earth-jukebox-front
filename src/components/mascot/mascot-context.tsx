"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type MascotContextValue = {
  visible: boolean;
  toggle: () => void;
};

const MascotContext = createContext<MascotContextValue | null>(null);

// El interruptor vive en el navbar (layout) y la mascota se renderiza dentro de la
// portada, así que el estado compartido tiene que colgar por encima de los dos.
export function MascotProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);

  return (
    <MascotContext value={{ visible, toggle: () => setVisible((shown) => !shown) }}>
      {children}
    </MascotContext>
  );
}

export function useMascot() {
  const context = useContext(MascotContext);
  if (!context) throw new Error("useMascot must be used inside <MascotProvider>");
  return context;
}
