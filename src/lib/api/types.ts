/**
 * Contrato de la API de SpotiEarth (`/api/v1`).
 *
 * Solo se tipan los campos que usa el front; el resto llega igual y se ignora.
 */

export interface PlaylistSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  cover_url: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface SourceMetadata {
  source?: string;
  profile_id?: string;
  topic?: string;
  /** Carpeta de frames: `public/data_ingest_resources/<frames_directory>/`. */
  frames_directory?: string;
  frame_count?: number;
  /** Ruta pública de la carpeta de imágenes, si no es `/data_ingest_resources/<frames_directory>`. */
  frames_base_url?: string;
  /** Extensión de las imágenes públicas; por defecto "webp". */
  frames_extension?: string;
  [key: string]: unknown;
}

export interface TrackSummary {
  id: number;
  playlist_id: number;
  slug: string;
  title: string;
  description: string | null;
  sequence_order: number;
  event_date: string | null;
  source_metadata: SourceMetadata;
  created_at: string;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: TrackSummary[];
}

export interface FrameTopRegion {
  id: string;
  name: string;
  value: number;
}

export interface Frame {
  frame_index: number;
  /** Nombre del archivo, p. ej. "frame_2024-01-01.png" (en `public/` es ".webp"). */
  frame_id: string;
  date?: string;
  features?: Record<string, number>;
  top_region?: FrameTopRegion | null;
  /** Cuadrícula de valores (fila 0 = norte); `null` donde no hay dato. */
  grid?: (number | null)[][] | null;
  [key: string]: unknown;
}

export interface EngineHints {
  level?: string;
  intensity?: string;
  secondary?: string;
  brightness?: string;
  more_is?: string;
  words?: Partial<Record<"image" | "melody" | "strong" | "subject" | "secondary", string>>;
  [key: string]: unknown;
}

export interface EngineMetadata {
  schema_version?: string;
  title?: string;
  label?: string;
  topic?: string;
  source?: string;
  kind?: string;
  /** Proyección de los frames: "equirectangular" (mapa 2:1) o "globe" (ya es una esfera). */
  projection?: string;
  unit?: string;
  /** Latitudes del borde superior e inferior del mapa. */
  lat_range?: [number, number];
  /** Longitudes del borde izquierdo y derecho del mapa. */
  lon_range?: [number, number];
  value_range?: [number, number];
  hints?: EngineHints;
  feature_stats?: Record<string, { min: number; max: number }>;
  warnings?: string[];
  [key: string]: unknown;
}

export interface TrackDetail extends TrackSummary {
  engine_metadata: EngineMetadata;
  frames: Frame[];
}
