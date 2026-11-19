import type { CountryRecord } from "../geo/catalog"
import type { StoryMission } from "../game/storyMissions"
import { CONTINENT_RU } from "./continents"
import { shiftDate, todayKey, type DailyTask } from "./daily"

export type WeeklyChallenge = {
  id: string
  title: string
  goal: number
  count: number
  xp: number
  done: boolean
}

export type ContinentStat = {
  xp: number
  visited: string[]
  puzzleDone: string[]
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

export function weekKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setHours(12, 0, 0, 0)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`
}

export function buildWeekly(continent: string): WeeklyChallenge[] {
  const ru = CONTINENT_RU[continent] ?? continent
  return [
    { id: "w-daily", title: "Закрой 3 ежедневных квеста", goal: 3, count: 0, xp: 70, done: false },
    { id: "w-open", title: `Открой 6 стран: ${ru}`, goal: 6, count: 0, xp: 80, done: false },
    { id: "w-puzzle", title: `Собери карту-пазл (${ru})`, goal: 1, count: 0, xp: 90, done: false },
  ]
}

export function buildLearningDailies(date: string, countries: CountryRecord[], continent: string): DailyTask[] {
  const pool = countries.filter(
    (c) => c.iso.length === 2 && c.continent === continent && (c.pop ?? 0) > 400_000,
  )
  const fallback = countries.filter((c) => c.iso.length === 2 && c.continent !== "Antarctica")
  const src = pool.length >= 3 ? [...pool] : [...fallback]
  const rng = mulberry32(dateSeed(date) + continent.length * 17)
  const pick = () => (src.length ? take(rng, src) : fallback[Math.floor(rng() * fallback.length)])
  const a = pick()
  const b = pick()
  const g = pick()
  const ru = CONTINENT_RU[continent] ?? continent
  return [
    {
      id: `daily-${date}-c0`,
      kind: "country",
      title: "Страна дня",
      story: `Найди страну: ${a.name}. Это ${ru}.`,
      goal: `Кликни ${a.name} на глобусе.`,
      hint: `Столица: ${a.capital || "—"}.`,
      recap: `${a.name} — ${ru}.`,
      iso: a.iso,
      lat: a.lat,
      lng: a.lng,
      continent,
      done: false,
    },
    {
      id: `daily-${date}-f0`,
      kind: "flag",
      title: "Флаг дня",
      story: "Перед тобой флаг. Найди страну на карте.",
      goal: "Кликни страну этого флага.",
      hint: `Столица: ${b.capital || "—"}. Материк: ${ru}.`,
      recap: `Это ${b.name}.`,
      iso: b.iso,
      lat: b.lat,
      lng: b.lng,
      continent,
      done: false,
    },
    {
      id: `daily-${date}-g0`,
      kind: "geo",
      title: "Гео-квест",
      story: `Столица ${g.capital || "этой страны"} стоит около ${g.lat.toFixed(1)}°, ${g.lng.toFixed(1)}°.`,
      goal: "Найди страну по подсказке.",
      hint: g.subregion || ru,
      recap: `Это ${g.name}.`,
      iso: g.iso,
      lat: g.lat,
      lng: g.lng,
      continent,
      done: false,
    },
  ]
}

export function learningDailyToMission(task: DailyTask): StoryMission {
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
  return {
    id: task.id,
    kind: task.kind === "geo" ? "capital" : "city",
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

export function bumpQuestStreak<T extends { lastQuestDate: string; questStreak: number; bestQuestStreak: number }>(
  progress: T,
): T {
  const day = todayKey()
  if (progress.lastQuestDate === day) return progress
  const streak = progress.lastQuestDate && shiftDate(day, -1) === progress.lastQuestDate ? progress.questStreak + 1 : 1
  return {
    ...progress,
    lastQuestDate: day,
    questStreak: streak,
    bestQuestStreak: Math.max(progress.bestQuestStreak, streak),
  }
}
