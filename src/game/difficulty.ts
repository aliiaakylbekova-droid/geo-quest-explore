export type Difficulty = "easy" | "medium" | "hard"

export type RoundRules = {
  difficulty: Difficulty
  timerMul: number
  freeHints: number
  extraCost: number
  pulseCost: number
  revealCost: number
  missPenalty: number
  showNames: boolean
  showBorders: boolean
  minPop: number
}

const WELL_KNOWN = new Set([
  "US", "CN", "IN", "RU", "BR", "JP", "DE", "GB", "FR", "IT", "ES", "CA", "AU", "MX", "KR", "TR",
  "EG", "SA", "ID", "NG", "AR", "ZA", "PL", "UA", "NL", "SE", "CH", "BE", "PT", "GR", "KZ", "UZ",
  "KG", "TJ", "TM", "PK", "BD", "VN", "TH", "PH", "MY", "IR", "IQ", "IL", "AE", "MA", "DZ", "KE",
  "ET", "CO", "PE", "CL", "NZ", "FI", "NO", "DK", "AT", "CZ", "HU", "RO", "IE", "AT",
])

const TABLE: Record<Difficulty, Omit<RoundRules, "difficulty" | "timerMul"> & { missionMul: number; campaignMul: number }> = {
  easy: {
    missionMul: 1.4,
    campaignMul: 1.35,
    freeHints: 3,
    extraCost: 6,
    pulseCost: 0,
    revealCost: 16,
    missPenalty: 0,
    showNames: true,
    showBorders: true,
    minPop: 20_000_000,
  },
  medium: {
    missionMul: 1,
    campaignMul: 1,
    freeHints: 2,
    extraCost: 8,
    pulseCost: 0,
    revealCost: 20,
    missPenalty: 8,
    showNames: false,
    showBorders: true,
    minPop: 5_000_000,
  },
  hard: {
    missionMul: 0.7,
    campaignMul: 0.75,
    freeHints: 1,
    extraCost: 10,
    pulseCost: 0,
    revealCost: 28,
    missPenalty: 16,
    showNames: false,
    showBorders: false,
    minPop: 0,
  },
}

export function rulesFor(difficulty: Difficulty, kind: "mission" | "campaign" = "mission"): RoundRules {
  const row = TABLE[difficulty]
  return {
    difficulty,
    timerMul: kind === "campaign" ? row.campaignMul : row.missionMul,
    freeHints: row.freeHints,
    extraCost: row.extraCost,
    pulseCost: row.pulseCost,
    revealCost: row.revealCost,
    missPenalty: row.missPenalty,
    showNames: row.showNames,
    showBorders: row.showBorders,
    minPop: row.minPop,
  }
}

export function isWellKnownIso(iso: string) {
  return WELL_KNOWN.has(iso)
}

export function filterCountryPool<T extends { iso: string; pop?: number | null }>(countries: T[], difficulty: Difficulty): T[] {
  const two = countries.filter((c) => c.iso.length === 2 && c.iso !== "AQ")
  if (difficulty === "hard") return two
  const minPop = TABLE[difficulty].minPop
  const filtered = two.filter((c) => isWellKnownIso(c.iso) || (c.pop ?? 0) >= minPop)
  return filtered.length >= 8 ? filtered : two
}

export function costForHint(index: number, kind: "continent" | "letter" | "capital" | "pulse" | "reveal", rules: RoundRules) {
  if (index < rules.freeHints) return 0
  if (kind === "reveal") return rules.revealCost
  if (kind === "pulse") return rules.pulseCost
  return rules.extraCost
}
