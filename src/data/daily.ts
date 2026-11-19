import type { CountryRecord } from "../geo/catalog"
import type { StoryMission } from "../game/storyMissions"

export type DailyKind = "country" | "flag" | "continent" | "geo"

export type DailyTask = {
  id: string
  kind: DailyKind
  title: string
  story: string
  goal: string
  hint: string
  recap: string
  iso?: string
  continent?: string
  lat?: number
  lng?: number
  done: boolean
}

const CONTINENT_RU: Record<string, string> = {
  Asia: "Азия",
  Europe: "Европа",
  Africa: "Африка",
  "North America": "Северная Америка",
  "South America": "Южная Америка",
  Oceania: "Океания",
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dateSeed(date: string) {
  return Number(date.replace(/-/g, "")) || 20261119
}

function take<T>(rng: () => number, pool: T[]): T {
  const i = Math.floor(rng() * pool.length)
  return pool.splice(i, 1)[0]
}

export function todayKey(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return todayKey(d)
}

export function buildDailyTasks(date: string, countries: CountryRecord[]): DailyTask[] {
  if (countries.length < 12) return []
  const rng = mulberry32(dateSeed(date))
  const pool = countries.filter((c) => c.iso.length === 2 && (c.pop ?? 0) > 800_000 && c.continent !== "Antarctica")
  const pickCountry = () => (pool.length ? take(rng, pool) : countries[Math.floor(rng() * countries.length)])
  const fiveCountries = Array.from({ length: 5 }, pickCountry)
  const fiveFlags = Array.from({ length: 5 }, pickCountry)
  const continents = ["Asia", "Europe", "Africa", "North America", "South America", "Oceania"]
  const continent = continents[Math.floor(rng() * continents.length)]
  const geo = pickCountry()
  const continentRu = CONTINENT_RU[continent] ?? continent

  const countryTasks: DailyTask[] = fiveCountries.map((c, i) => ({
    id: `daily-${date}-c${i}`,
    kind: "country",
    title: `Страна ${i + 1}`,
    story: `Найди страну: ${c.name}.`,
    goal: `Кликни ${c.name} на глобусе.`,
    hint: `${CONTINENT_RU[c.continent] ?? c.continent}. Столица: ${c.capital || "—"}.`,
    recap: `${c.name} — ${CONTINENT_RU[c.continent] ?? c.continent}.`,
    iso: c.iso,
    lat: c.lat,
    lng: c.lng,
    done: false,
  }))

  const flagTasks: DailyTask[] = fiveFlags.map((c, i) => ({
    id: `daily-${date}-f${i}`,
    kind: "flag",
    title: `Флаг ${i + 1}`,
    story: "Перед тобой флаг. Найди страну на карте мира.",
    goal: "Кликни страну, которой принадлежит этот флаг.",
    hint: `Столица: ${c.capital || "—"}. Материк: ${CONTINENT_RU[c.continent] ?? c.continent}.`,
    recap: `Это ${c.name}. Столица — ${c.capital}.`,
    iso: c.iso,
    lat: c.lat,
    lng: c.lng,
    done: false,
  }))

  const continentTask: DailyTask = {
    id: `daily-${date}-cont`,
    kind: "continent",
    title: "Материк",
    story: `Кликни любую страну материка ${continentRu}.`,
    goal: `Найди ${continentRu}.`,
    hint: continent === "Asia" ? "Самый большой материк, к востоку от Урала." : `Ищи подпись ${continentRu} на глобусе.`,
    recap: `${continentRu} отмечен.`,
    continent,
    done: false,
  }

  const geoTask: DailyTask = {
    id: `daily-${date}-geo`,
    kind: "geo",
    title: "Гео-подсказка",
    story: `Столица ${geo.capital || "этой страны"} стоит около ${geo.lat.toFixed(1)}°, ${geo.lng.toFixed(1)}°. Материк: ${CONTINENT_RU[geo.continent] ?? geo.continent}.`,
    goal: "Найди страну по географической подсказке.",
    hint: geo.subregion || geo.continent,
    recap: `Это ${geo.name}.`,
    iso: geo.iso,
    lat: geo.lat,
    lng: geo.lng,
    done: false,
  }

  return [...countryTasks, ...flagTasks, continentTask, geoTask]
}

export function dailyToMission(task: DailyTask): StoryMission {
  if (task.kind === "flag") {
    return {
      id: task.id,
      kind: "flag",
      title: task.title,
      story: task.story,
      goal: task.goal,
      hint: task.hint,
      recap: task.recap,
      timeMs: 55_000,
      xp: 80,
      targetIso: task.iso,
      targetName: task.recap,
      lat: task.lat,
      lng: task.lng,
    }
  }
  if (task.kind === "continent") {
    return {
      id: task.id,
      kind: "continent",
      title: task.title,
      story: task.story,
      goal: task.goal,
      hint: task.hint,
      recap: task.recap,
      timeMs: 50_000,
      xp: 90,
      continent: task.continent,
    }
  }
  if (task.kind === "geo") {
    return {
      id: task.id,
      kind: "capital",
      title: task.title,
      story: task.story,
      goal: task.goal,
      hint: task.hint,
      recap: task.recap,
      timeMs: 55_000,
      xp: 95,
      targetIso: task.iso,
      lat: task.lat,
      lng: task.lng,
    }
  }
  return {
    id: task.id,
    kind: "city",
    title: task.title,
    story: task.story,
    goal: task.goal,
    hint: task.hint,
    recap: task.recap,
    timeMs: 50_000,
    xp: 80,
    targetIso: task.iso,
    lat: task.lat,
    lng: task.lng,
  }
}

export const CONTINENTS = ["Asia", "Europe", "Africa", "North America", "South America", "Oceania"] as const
