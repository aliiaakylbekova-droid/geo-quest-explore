import type { HelpKind } from "../data/helps"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"

const KINDS: HelpKind[] = ["extraHint", "skip", "freeze", "revealRegion"]

function label(kind: HelpKind) {
  const ui = t().play
  if (kind === "extraHint") return ui.helpExtraHint
  if (kind === "skip") return ui.helpSkip
  if (kind === "freeze") return ui.helpFreeze
  return ui.helpReveal
}

export function HelpDock() {
  const helps = useGame((s) => s.progress.helps)
  const freezeUntil = useGame((s) => s.freezeUntil)
  const stage = useGame((s) => s.stage)
  const journey = useGame((s) => s.journey)
  const useSkip = useGame((s) => s.useSkip)
  const useFreeze = useGame((s) => s.useFreeze)
  const useRevealRegion = useGame((s) => s.useRevealRegion)
  const requestExtraHint = useGame((s) => s.requestExtraHint)
  const ui = t().play
  const hunt = stage === "mission" || stage === "flag" || journey?.leg === "explore" || journey?.leg === "flags"
  const total = KINDS.reduce((n, k) => n + (helps[k] ?? 0), 0)
  if (!hunt || total <= 0) return null
  const frozen = Boolean(freezeUntil && freezeUntil > Date.now())

  return (
    <div className="gq-help-dock" aria-label={ui.helps}>
      {KINDS.map((kind) => {
        const n = helps[kind] ?? 0
        if (n <= 0) return null
        const run =
          kind === "skip" ? useSkip : kind === "freeze" ? useFreeze : kind === "revealRegion" ? useRevealRegion : requestExtraHint
        const off = kind === "freeze" && frozen
        return (
          <button key={kind} type="button" className="chip" disabled={off} onClick={() => run()}>
            {label(kind)} · {n}
          </button>
        )
      })}
    </div>
  )
}
