import { useEffect, useState } from "react"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"

function AnimatedXp({ target }: { target: number }) {
  const [shown, setShown] = useState(target)
  useEffect(() => {
    let frame = 0
    const start = shown
    const diff = target - start
    if (diff === 0) return
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700)
      const ease = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(start + diff * ease))
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return <b className="xp-pop">{shown} XP</b>
}

export function CampaignOverlay() {
  const campaign = useGame((s) => s.campaign)
  const phase = useGame((s) => s.campaignPhase)
  const lastCountryName = useGame((s) => s.lastCountryName)
  const progress = useGame((s) => s.progress)
  const lastFeedback = useGame((s) => s.lastFeedback)
  const flagMoment = useGame((s) => s.flagMoment)
  const lastPenalty = useGame((s) => s.lastPenalty)
  const mission = useGame((s) => s.mission)
  const stage = useGame((s) => s.stage)
  const toast = useGame((s) => s.toast)
  const restartAfterTimeout = useGame((s) => s.restartAfterTimeout)
  const ui = t().play
  void useGame((s) => s.progress.locale)

  if (stage === "discover") return null
  if (phase === "timeout") {
    return (
      <div className="gq-timeout-end" data-result="timeout">
        <p className="gq-verdict is-timeout">{ui.gameOver}</p>
        <p className="gq-timeout-sub">{ui.timesUp}</p>
        <p className="gq-penalty">{ui.scorePenalty.replace("{n}", String(lastPenalty || 20))}</p>
        <button type="button" className="btn intro-start" onClick={() => restartAfterTimeout()}>
          {ui.restart}
        </button>
      </div>
    )
  }
  if (stage === "flag" && (flagMoment || lastFeedback)) {
    if (flagMoment === "win" || lastFeedback?.ok) {
      if (toast) return null
      return (
        <div className="gq-ticket is-compact" data-result="ticket">
          <p className="gq-verdict is-ok">{ui.verdictOk}</p>
          <p className="gq-ticket-copy">{ui.nextTicket}</p>
        </div>
      )
    }
    return (
      <>
        <div className="gq-wrong-center" data-result="wrong">
          <p className="gq-verdict is-bad">{ui.verdictBad}</p>
          <p className="gq-bang" aria-hidden>
            !
          </p>
          <h2>{ui.flagWrong}</h2>
        </div>
        {mission?.hint ? (
          <aside className="gq-hint-drawer" data-result="hint">
            <p className="kicker">{ui.hint}</p>
            <p>{mission.hint}</p>
          </aside>
        ) : null}
      </>
    )
  }
  if (!campaign && lastFeedback) {
    if (lastFeedback.ok) {
      if (toast) return null
      return (
        <div className="gq-result is-ok is-compact" data-result="success">
          <p className="gq-verdict is-ok">{ui.verdictOk}</p>
          <p className="place">{lastCountryName || mission?.targetName}</p>
        </div>
      )
    }
    return (
      <div className="gq-result is-wrong" data-result="wrong">
        <p className="gq-verdict is-bad">{ui.verdictBad}</p>
        <p className="kicker">{ui.tryAgain}</p>
        <h2>{ui.notThisPlace}</h2>
        <p>{lastFeedback.text}</p>
      </div>
    )
  }
  if (!campaign) return null
  if (phase === "play" || phase === "correct" || phase === "transition") return null

  if (phase === "wrong") {
    return (
      <div className="gq-result is-wrong" data-result="wrong">
        <p className="gq-verdict is-bad">{ui.verdictBad}</p>
        <p className="kicker">{ui.tryAgain}</p>
        <h2>{ui.notThisPlace}</h2>
        <p>
          {lastCountryName ? `${lastCountryName} ${ui.notTarget}` : ui.missClick} {lastFeedback?.text || campaign.hint}
        </p>
      </div>
    )
  }

  if (phase === "success") {
    if (toast) return null
    return (
      <div className="gq-result is-ok is-compact" data-result="success">
        <p className="gq-verdict is-ok">{ui.verdictOk}</p>
        <p className="place">{lastCountryName || campaign.title}</p>
      </div>
    )
  }

  if (phase === "campaignComplete") {
    return (
      <div className="gq-result is-ok" data-result="campaign">
        <p className="kicker">{ui.campaignDone}</p>
        <h2>{ui.geoGame}</h2>
        <p>{ui.campaignWrap}</p>
        <AnimatedXp target={progress.xp} />
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            useGame.setState({ campaign: null, campaignPhase: "play", hitTint: null, missionEndsAt: null })
            useGame.getState().setStage("explore")
          }}
        >
          {ui.exploreWorld}
        </button>
      </div>
    )
  }

  return null
}
