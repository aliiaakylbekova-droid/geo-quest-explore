import { t } from "../i18n"
import { useGame } from "../store/gameStore"
import { costForHint } from "./difficulty"
import { baseHintText, buildExtraHints } from "./hintSteps"

function LampIcon() {
  return (
    <svg className="hint-lamp" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21h6M10 18h4" fill="none" />
      <path d="M8 10a4 4 0 1 1 8 0c0 2.2-1.4 3.4-2.2 4.4-.4.5-.8 1.2-.8 1.6h-2c0-.4-.4-1.1-.8-1.6C9.4 13.4 8 12.2 8 10z" />
    </svg>
  )
}

export function HintLadder() {
  const stage = useGame((s) => s.stage)
  const mission = useGame((s) => s.mission)
  const campaign = useGame((s) => s.campaign)
  const hintOn = useGame((s) => s.baseHintOn)
  const hintRung = useGame((s) => s.hintRung)
  const hintLine = useGame((s) => s.hintLine)
  const hintLines = useGame((s) => s.hintLines)
  const roundRules = useGame((s) => s.roundRules)
  const lastFeedback = useGame((s) => s.lastFeedback)
  const coins = useGame((s) => s.progress.coins)
  const requestExtraHint = useGame((s) => s.requestExtraHint)
  const showBaseHint = useGame((s) => s.showBaseHint)
  const ui = t().play
  const hunt = (stage === "mission" || stage === "flag") && Boolean(mission || campaign)
  if (!hunt) return null

  const steps = buildExtraHints(mission, campaign)
  const next = steps[hintRung]
  const won = Boolean(lastFeedback?.ok)
  const cost = next && roundRules ? costForHint(hintRung, next.kind, roundRules) : 0
  const canPay = cost === 0 || coins >= cost
  const nextLabel =
    next?.kind === "reveal"
      ? ui.hintRevealCost.replace("{n}", String(cost || roundRules?.revealCost || 0))
      : next?.kind === "pulse"
        ? cost > 0
          ? ui.hintPulseCost.replace("{n}", String(cost))
          : ui.hintPulseBtn
        : hintRung === 0
          ? ui.hintMore
          : ui.hintNext
  const freeLeft = roundRules ? Math.max(0, roundRules.freeHints - hintRung) : 0
  const base = baseHintText(mission, campaign)

  return (
    <div className="hint-ladder" data-hint-rung={hintRung}>
      {hintOn && base ? <p className="hint-box hint-box-sm">{base}</p> : null}
      {(hintLines.length ? hintLines : hintLine ? [hintLine] : []).map((line, i) => (
        <p key={`${i}-${line}`} className="hint-box hint-box-sm extra">
          {line}
        </p>
      ))}
      <div className="hint-actions">
        {base ? (
          <button type="button" className="btn ghost hint-lamp-btn" disabled={won} onClick={() => showBaseHint()}>
            <LampIcon />
            {ui.hint}
          </button>
        ) : null}
        {next && !won ? (
          <button
            type="button"
            className="btn ghost"
            data-extra-hint="next"
            disabled={!canPay}
            onClick={() => requestExtraHint()}
          >
            {cost > 0 || next.kind === "pulse" || next.kind === "reveal" ? nextLabel : hintRung === 0 ? ui.hintMore : ui.hintNext}
          </button>
        ) : null}
      </div>
      {!won && next ? (
        <p className="hint-meta">
          {cost > 0 ? (
            <span className="hint-cost">−{cost} ◆</span>
          ) : (
            <span>{ui.hintFreeLeft.replace("{n}", String(freeLeft))}</span>
          )}
        </p>
      ) : null}
    </div>
  )
}
