import { CloudOff } from "lucide-react";
import { ApiError } from "@/lib/api/client";

/** Aviso cuando la API no responde o devuelve un error. */
export function ApiErrorNotice({ error, title = "Couldn't load the playlists" }: { error: unknown; title?: string }) {
  const message = error instanceof ApiError ? error.message : "Unexpected error while loading data.";
  return (
    <div role="alert" className="glass flex items-start gap-4 rounded-lg p-6">
      <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-glass-muted" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-glass-muted">{message}</p>
      </div>
    </div>
  );
}
