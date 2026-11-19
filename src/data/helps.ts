export const HELP_KINDS = ["extraHint", "skip", "freeze", "revealRegion"] as const
export type HelpKind = (typeof HELP_KINDS)[number]

export type HelpCounts = Record<HelpKind, number>

export type PrizeBox = {
  id: string
  opened: boolean
  grant: HelpKind | null
}

export function emptyHelps(): HelpCounts {
  return { extraHint: 0, skip: 0, freeze: 0, revealRegion: 0 }
}

export function mergeHelps(raw: unknown): HelpCounts {
  const next = emptyHelps()
  if (!raw || typeof raw !== "object") return next
  const o = raw as Record<string, unknown>
  for (const kind of HELP_KINDS) {
    next[kind] = Math.max(0, Math.floor(Number(o[kind]) || 0))
  }
  return next
}

export function rollGrant(): HelpKind {
  return HELP_KINDS[Math.floor(Math.random() * HELP_KINDS.length)]
}

export function makePrizeBoxes(count = 3): PrizeBox[] {
  const stamp = Date.now().toString(36)
  return Array.from({ length: count }, (_, i) => ({
    id: `box-${stamp}-${i}`,
    opened: false,
    grant: null,
  }))
}

export function mergePrizeBoxes(raw: unknown): PrizeBox[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, i) => {
      if (!item || typeof item !== "object") return null
      const o = item as Record<string, unknown>
      const grant = HELP_KINDS.includes(o.grant as HelpKind) ? (o.grant as HelpKind) : null
      return {
        id: typeof o.id === "string" ? o.id : `box-old-${i}`,
        opened: Boolean(o.opened),
        grant,
      }
    })
    .filter((b): b is PrizeBox => Boolean(b))
}
