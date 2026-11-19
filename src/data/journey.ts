import type { LearningContinent } from "./continents"

export const JOURNEY_EXPLORE_GOAL = 5
export const JOURNEY_FLAGS_GOAL = 5
export const JOURNEY_SESSION_KEY = "gq-journey"

export type JourneyLeg = "pick" | "explore" | "inter-flags" | "flags" | "inter-puzzle" | "puzzle" | "results"

export type Journey = {
  id: string
  continent: LearningContinent
  startedAt: number
  leg: JourneyLeg
  targetIso: string | null
  usedIsos: string[]
  exploreCorrect: number
  flagsStreak: number
  flagsBest: number
  puzzleLeftoverMs: number
  xpPending: number
  awarded: boolean
}

export function newJourneyId() {
  return `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeJourney(continent: LearningContinent): Journey {
  return {
    id: newJourneyId(),
    continent,
    startedAt: Date.now(),
    leg: "explore",
    targetIso: null,
    usedIsos: [],
    exploreCorrect: 0,
    flagsStreak: 0,
    flagsBest: 0,
    puzzleLeftoverMs: 0,
    xpPending: 0,
    awarded: false,
  }
}

export function journeyXp(j: Journey) {
  const explore = j.exploreCorrect * 22
  const flags = j.flagsBest * 36 + (j.flagsBest >= JOURNEY_FLAGS_GOAL ? 40 : 0)
  const puzzle = 90 + Math.min(40, Math.round(j.puzzleLeftoverMs / 4000))
  return explore + flags + puzzle
}

export function readJourneySession(): Journey | null {
  try {
    const raw = sessionStorage.getItem(JOURNEY_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Journey
    if (!parsed?.id || parsed.awarded) return null
    return parsed
  } catch {
    return null
  }
}

export function writeJourneySession(journey: Journey | null) {
  try {
    if (!journey || journey.awarded) sessionStorage.removeItem(JOURNEY_SESSION_KEY)
    else sessionStorage.setItem(JOURNEY_SESSION_KEY, JSON.stringify(journey))
  } catch {
    /* private mode */
  }
}
