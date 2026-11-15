/**
 * Continente de cada país del mapa `world-atlas/countries-110m.json`, por su
 * nombre en ese archivo (tres países no traen id ISO). Criterio de Natural
 * Earth, salvo Rusia, que se reparte entre Europa y Asia por los Urales.
 */

const BY_CONTINENT: Record<string, readonly string[]> = {
  "North America": [
    "Canada", "United States of America", "Mexico", "Greenland", "Guatemala", "Belize", "Honduras", "El Salvador",
    "Nicaragua", "Costa Rica", "Panama", "Cuba", "Haiti", "Dominican Rep.", "Jamaica", "Puerto Rico", "Bahamas",
    "Trinidad and Tobago",
  ],
  "South America": [
    "Brazil", "Argentina", "Chile", "Uruguay", "Paraguay", "Bolivia", "Peru", "Ecuador", "Colombia", "Venezuela",
    "Guyana", "Suriname", "Falkland Is.",
  ],
  Europe: [
    "Russia", "Norway", "Sweden", "Finland", "Denmark", "Iceland", "United Kingdom", "Ireland", "France", "Spain",
    "Portugal", "Germany", "Netherlands", "Belgium", "Luxembourg", "Switzerland", "Austria", "Italy", "Poland",
    "Czechia", "Slovakia", "Hungary", "Slovenia", "Croatia", "Bosnia and Herz.", "Serbia", "Montenegro", "Kosovo",
    "Albania", "Macedonia", "Greece", "Bulgaria", "Romania", "Moldova", "Ukraine", "Belarus", "Lithuania", "Latvia",
    "Estonia",
  ],
  Asia: [
    "Kazakhstan", "Uzbekistan", "Turkmenistan", "Kyrgyzstan", "Tajikistan", "Afghanistan", "Pakistan", "India",
    "Nepal", "Bhutan", "Bangladesh", "Sri Lanka", "Myanmar", "Thailand", "Laos", "Cambodia", "Vietnam", "Malaysia",
    "Brunei", "Indonesia", "Philippines", "Timor-Leste", "China", "Taiwan", "Mongolia", "North Korea", "South Korea",
    "Japan", "Iran", "Iraq", "Syria", "Lebanon", "Israel", "Palestine", "Jordan", "Saudi Arabia", "Yemen", "Oman",
    "United Arab Emirates", "Qatar", "Kuwait", "Turkey", "Georgia", "Armenia", "Azerbaijan", "Cyprus", "N. Cyprus",
  ],
  Africa: [
    "Tanzania", "W. Sahara", "Dem. Rep. Congo", "Somalia", "Kenya", "Sudan", "Chad", "South Africa", "Lesotho",
    "Zimbabwe", "Botswana", "Namibia", "Senegal", "Mali", "Mauritania", "Benin", "Niger", "Nigeria", "Cameroon",
    "Togo", "Ghana", "Côte d'Ivoire", "Guinea", "Guinea-Bissau", "Liberia", "Sierra Leone", "Burkina Faso",
    "Central African Rep.", "Congo", "Gabon", "Eq. Guinea", "Zambia", "Malawi", "Mozambique", "eSwatini", "Angola",
    "Burundi", "Madagascar", "Gambia", "Tunisia", "Algeria", "Morocco", "Egypt", "Libya", "Ethiopia", "Djibouti",
    "Somaliland", "Uganda", "Rwanda", "Eritrea", "S. Sudan",
  ],
  Oceania: ["Fiji", "Papua New Guinea", "Vanuatu", "New Caledonia", "Solomon Is.", "New Zealand", "Australia"],
};

export const CONTINENT_OF: ReadonlyMap<string, string> = new Map(
  Object.entries(BY_CONTINENT).flatMap(([continent, names]) => names.map((n) => [n, continent] as const)),
);

/** Nombre hablado de los países que el mapa abrevia. */
export const SPOKEN_NAME: Readonly<Record<string, string>> = {
  "United States of America": "the United States",
  "Dem. Rep. Congo": "the Democratic Republic of the Congo",
  Congo: "the Republic of the Congo",
  "W. Sahara": "Western Sahara",
  "Central African Rep.": "the Central African Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "S. Sudan": "South Sudan",
  "Dominican Rep.": "the Dominican Republic",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  Macedonia: "North Macedonia",
  eSwatini: "Eswatini",
  "N. Cyprus": "Northern Cyprus",
  "Solomon Is.": "the Solomon Islands",
  "Falkland Is.": "the Falkland Islands",
  "Fr. S. Antarctic Lands": "the French Southern and Antarctic Lands",
  "Côte d'Ivoire": "Ivory Coast",
  "United Kingdom": "the United Kingdom",
  "United Arab Emirates": "the United Arab Emirates",
  Netherlands: "the Netherlands",
  Philippines: "the Philippines",
  Bahamas: "the Bahamas",
  Gambia: "the Gambia",
};
