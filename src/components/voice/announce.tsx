"use client";

import { useEffect } from "react";
import { useVoice } from "@/components/voice/voice-context";

/** Dice `text` en voz alta al mostrarse (y otra vez si se reactiva la voz). */
export function Announce({ text }: { text: string }) {
  const { say } = useVoice();
  useEffect(() => {
    say(text);
  }, [text, say]);
  return null;
}
