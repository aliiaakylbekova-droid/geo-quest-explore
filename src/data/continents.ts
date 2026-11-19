export const LEARNING_CONTINENTS = [
  "Europe",
  "Asia",
  "Africa",
  "North America",
  "South America",
  "Oceania",
] as const

export type LearningContinent = (typeof LEARNING_CONTINENTS)[number]

export const CONTINENT_RU: Record<string, string> = {
  Asia: "Азия",
  Europe: "Европа",
  Africa: "Африка",
  "North America": "Северная Америка",
  "South America": "Южная Америка",
  Oceania: "Океания",
  Antarctica: "Антарктида",
}

export const CONTINENT_EN: Record<string, string> = {
  Asia: "Asia",
  Europe: "Europe",
  Africa: "Africa",
  "North America": "North America",
  "South America": "South America",
  Oceania: "Oceania",
  Antarctica: "Antarctica",
}

export const CONTINENT_FLY: Record<string, { lat: number; lng: number; dist: number }> = {
  Asia: { lat: 32, lng: 95, dist: 5.15 },
  Europe: { lat: 50, lng: 15, dist: 4.85 },
  Africa: { lat: 4, lng: 22, dist: 5.35 },
  "North America": { lat: 42, lng: -100, dist: 5.45 },
  "South America": { lat: -15, lng: -60, dist: 5.25 },
  Oceania: { lat: -24, lng: 145, dist: 5.35 },
}

/** CSS background-position on equirectangular earth-day.jpg */
export const CONTINENT_PHOTO: Record<string, { x: string; y: string; size: string }> = {
  Europe: { x: "52%", y: "28%", size: "220%" },
  Asia: { x: "72%", y: "34%", size: "210%" },
  Africa: { x: "54%", y: "48%", size: "230%" },
  "North America": { x: "22%", y: "32%", size: "220%" },
  "South America": { x: "32%", y: "62%", size: "240%" },
  Oceania: { x: "88%", y: "68%", size: "250%" },
}

export function continentLabel(id: string, locale: "ru" | "en" = "ru") {
  return (locale === "en" ? CONTINENT_EN[id] : CONTINENT_RU[id]) ?? id
}
