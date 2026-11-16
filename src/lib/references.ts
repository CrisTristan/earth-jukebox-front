/**
 * APIs, servicios y tecnologías que usa Earth Jukebox (front y backend).
 * Fuente de la página `/references`: para añadir o corregir algo, se edita aquí.
 */

/** Parte del proyecto que usa el servicio. */
export type Side = "Frontend" | "Backend" | "Project";

export type ServiceIcon = "satellite" | "palette" | "library" | "map" | "speech" | "music" | "type" | "database" | "container";

export interface ExternalService {
  name: string;
  category: string;
  icon: ServiceIcon;
  description: string;
  uses: string[];
  usedBy: Side[];
  href: string;
}

export interface StackItem {
  name: string;
  role: string;
  href: string;
}

/** APIs y servicios externos, de los datos de NASA a la infraestructura. */
export const EXTERNAL_SERVICES: ExternalService[] = [
  {
    name: "NASA Scientific Visualization Studio (SVS)",
    category: "Visualizations",
    icon: "satellite",
    description: "NASA's library of animated Earth science visualizations. Every timelapse we turn into sound starts here.",
    uses: [
      "Frames downloaded from 9 SVS frame folders (GEOS-FP weather and air quality, ECCO2 currents, CO₂ globe)",
      "Frames extracted from 5 SVS videos (humidity, ISS lightning, Perpetual Ocean 2)",
      "13 color bars used to rebuild the value scale of each visualization",
      "Timelapse frames and thumbnails shown in the player",
    ],
    usedBy: ["Backend", "Frontend"],
    href: "https://svs.gsfc.nasa.gov/",
  },
  {
    name: "NASA Global Imagery Browse Services (GIBS)",
    category: "Satellite",
    icon: "palette",
    description: "NASA's satellite imagery service, with the official color tables (colormaps v1.3) of each layer.",
    uses: [
      "Official color tables for IMERG precipitation, GHRSST sea temperature anomalies and MODIS NDVI",
      "Turning each pixel color back into its physical value (mm/h, °C, NDVI)",
      "Satellite maps behind the rain, sea temperature and vegetation tracks",
    ],
    usedBy: ["Backend"],
    href: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/",
  },
  {
    name: "NASA Earth Information Center (EIC)",
    category: "Catalog",
    icon: "library",
    description: "The Earth visualization content database provided by the Space Apps challenge.",
    uses: [
      "Starting point to choose the datasets of each playlist",
      "11 challenge resources, listed on the NASA Data page",
      "Inspiration from NASA's own data sonification work (Caldwell 73)",
    ],
    usedBy: ["Project"],
    href: "https://svs.gsfc.nasa.gov/gallery/earth-information-center/",
  },
  {
    name: "Natural Earth · world-atlas",
    category: "Cartography",
    icon: "map",
    description: "Public domain map data. The world-atlas package ships its 1:110m country borders as TopoJSON.",
    uses: [
      "Country borders loaded by the player map",
      "Naming the country and continent you click on (Map voice)",
      "Telling land apart from seas and oceans",
    ],
    usedBy: ["Frontend"],
    href: "https://www.naturalearthdata.com/",
  },
  {
    name: "Web Speech API",
    category: "Accessibility",
    icon: "speech",
    description: "The browser's built-in speech synthesis. No keys, no accounts, no external servers.",
    uses: [
      "Voice guide (V key) that reads buttons and sections while moving with the keyboard",
      "Announcing the playlist or track when a page opens",
      "Map voice: saying the name of the place you click",
    ],
    usedBy: ["Frontend"],
    href: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API",
  },
  {
    name: "Versilian Community Sample Library (VCSL)",
    category: "Sound",
    icon: "music",
    description: "A free library of recorded acoustic instruments, released into the public domain (CC0) by Versilian Studios.",
    uses: [
      "100 instrument samples (kalimba, marimba, harp, organ, saxello, wine glasses, psaltery, didgeridoo, bells, percussion)",
      "The melody of every track and the musical textures of the air quality, wind, ocean, CO₂ and lightning tracks",
      "The notes of the map radar and of the click on the map",
      "Trimmed, normalized and converted to MP3 to keep the player light (about 4 MB)",
    ],
    usedBy: ["Frontend"],
    href: "https://github.com/sgossner/VCSL",
  },
  {
    name: "Google Fonts",
    category: "Typography",
    icon: "type",
    description: "Open source font library, loaded with next/font.",
    uses: [
      "Manrope for body text and Instrument Serif for headings",
      "Downloaded at build time and served from our own site: visitors' browsers never contact Google",
    ],
    usedBy: ["Frontend"],
    href: "https://fonts.google.com/",
  },
  {
    name: "PostgreSQL",
    category: "Database",
    icon: "database",
    description: "Open source relational database, running from the postgres:18-alpine image.",
    uses: [
      "Stores every playlist and track",
      "Keeps each track's measurements (frames, grid and regions) as JSONB",
      "Read by the SpotiEarth API to answer the front",
    ],
    usedBy: ["Backend"],
    href: "https://www.postgresql.org/",
  },
  {
    name: "Docker",
    category: "Infrastructure",
    icon: "container",
    description: "Containers for a development environment that is the same on every machine.",
    uses: [
      "Dev container for the API (Python 3.13)",
      "Runs the API and PostgreSQL together with Docker Compose",
    ],
    usedBy: ["Backend"],
    href: "https://www.docker.com/",
  },
];

/** El backend del proyecto: la API que consume el front. */
export const OWN_API = {
  name: "SpotiEarth API",
  description:
    "Our backend. It measures each NASA frame with its color table, saves the results in PostgreSQL and serves them as playlists and tracks.",
  endpoints: [
    { method: "GET", path: "/api/v1/playlists", use: "Home: list of playlists" },
    { method: "GET", path: "/api/v1/playlists/{slug}", use: "Playlist page and its tracks" },
    { method: "GET", path: "/api/v1/tracks/{slug}", use: "Player: every frame with its values" },
  ],
  uses: [
    "Converts pixel colors into physical values with the GIBS tables and SVS color bars",
    "Summarizes each frame: named features, a 24 × 48 grid and regions (oceans, continents)",
    "Rate limiting of 60 requests per minute (SlowAPI)",
  ],
};

/** Tecnologías con las que está construido cada lado del proyecto. */
export const STACK: { side: "Frontend" | "Backend"; items: StackItem[] }[] = [
  {
    side: "Frontend",
    items: [
      { name: "Next.js 16", role: "App Router, server components", href: "https://nextjs.org/" },
      { name: "React 19", role: "User interface", href: "https://react.dev/" },
      { name: "TypeScript", role: "Typed code", href: "https://www.typescriptlang.org/" },
      { name: "Tailwind CSS 4", role: "Styles", href: "https://tailwindcss.com/" },
      { name: "d3-geo", role: "Map projection and hit tests", href: "https://d3js.org/d3-geo" },
      { name: "TopoJSON client", role: "Reads the world map", href: "https://github.com/topojson/topojson-client" },
      { name: "Lucide", role: "Icons", href: "https://lucide.dev/" },
    ],
  },
  {
    side: "Backend",
    items: [
      { name: "Python 3.13", role: "Language", href: "https://www.python.org/" },
      { name: "FastAPI + Uvicorn", role: "REST API and server", href: "https://fastapi.tiangolo.com/" },
      { name: "SQLAlchemy", role: "Database access", href: "https://www.sqlalchemy.org/" },
      { name: "Pydantic Settings", role: "Configuration", href: "https://docs.pydantic.dev/latest/concepts/pydantic_settings/" },
      { name: "SlowAPI", role: "Rate limiting", href: "https://github.com/laurentS/slowapi" },
      { name: "OpenCV", role: "Video frames and color matching", href: "https://opencv.org/" },
      { name: "NumPy", role: "Pixel math", href: "https://numpy.org/" },
      { name: "Pillow", role: "Image files", href: "https://python-pillow.org/" },
    ],
  },
];
