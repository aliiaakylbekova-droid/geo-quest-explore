import { useEffect, useState } from "react"
import { STORY_MISSIONS } from "./storyMissions"
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

function Fireworks() {
  return (
    <div className="gq-fireworks" aria-hidden>
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  )
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
  const rewardPulse = useGame((s) => s.rewardPulse)
  const missionSummary = useGame((s) => s.missionSummary)
  const lastHit = useGame((s) => s.lastHit)
  const screenFlash = useGame((s) => s.screenFlash)
  const hitTint = useGame((s) => s.hitTint)
  const restartAfterTimeout = useGame((s) => s.restartAfterTimeout)
  const missKey = `${lastHit?.lat}-${lastHit?.lng}-${lastFeedback?.ok}`
  const missFlash = screenFlash === "red" || hitTint === "red" || flagMoment === "lose"
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

  if (missionSummary && lastFeedback?.ok) {
    return (
      <div className="gq-mastery" data-result="summary">
        <Fireworks />
        <p className="kicker">{ui.missionSummary}</p>
        <h2>{missionSummary.title}</h2>
        <p className="gq-mastery-rank">{ui.greatJob}</p>
        <p>{missionSummary.recap}</p>
        <p className="gq-mastery-earn">
          {ui.reward}: <b>+{missionSummary.xp} XP</b>
          <span>+{missionSummary.coins} ◆</span>
          <span>
            {ui.streak} {missionSummary.streak}
          </span>
        </p>
        <AnimatedXp target={progress.xp} />
      </div>
    )
  }

  if (stage === "flag" && (flagMoment || lastFeedback)) {
    if (flagMoment === "win" || lastFeedback?.ok) {
      return (
        <div className="gq-ticket is-compact" data-result="ticket">
          <Fireworks />
          <p className="gq-verdict is-ok">{ui.verdictOk}</p>
          {rewardPulse ? <p className="xp-line">+{rewardPulse} XP</p> : null}
          <p className="gq-ticket-copy">{ui.nextTicket}</p>
        </div>
      )
    }
    if (missFlash && lastFeedback && !lastFeedback.ok) {
      return (
        <div className="gq-wrong-center" data-result="wrong" key={missKey}>
          <p className="gq-verdict is-bad">{ui.verdictBad}</p>
          <p className="kicker">{ui.tryAgain}</p>
          <h2>{ui.flagWrong}</h2>
        </div>
      )
    }
  }

  if (!campaign && lastFeedback) {
    if (lastFeedback.ok) {
      const idx = mission ? STORY_MISSIONS.findIndex((m) => m.id === mission.id) : -1
      const hasNext = idx >= 0 && Boolean(STORY_MISSIONS[idx + 1])
      return (
        <div className="gq-ticket is-compact" data-result="success">
          <Fireworks />
          <p className="gq-verdict is-ok">{ui.verdictOk}</p>
          <p className="place">{lastCountryName || mission?.targetName}</p>
          {rewardPulse ? <p className="xp-line">+{rewardPulse} XP</p> : null}
          <p className="gq-ticket-copy">{hasNext ? ui.nextTask : ui.greatJob}</p>
        </div>
      )
    }
    if (!missFlash) return null
    return (
      <div className="gq-wrong-center" data-result="wrong" key={missKey}>
        <p className="gq-verdict is-bad">{ui.verdictBad}</p>
        <p className="kicker">{ui.tryAgain}</p>
        <h2>{ui.notThisPlace}</h2>
      </div>
    )
  }
  if (!campaign) return null
  if (phase === "play" || phase === "correct" || phase === "transition") return null

  if (phase === "wrong") {
    return (
      <div className="gq-wrong-center" data-result="wrong" key={missKey}>
        <p className="gq-verdict is-bad">{ui.verdictBad}</p>
        <p className="kicker">{ui.tryAgain}</p>
        <h2>{ui.notThisPlace}</h2>
      </div>
    )
  }

  if (phase === "success") {
    return (
      <div className="gq-ticket is-compact" data-result="success">
        <Fireworks />
        <p className="gq-verdict is-ok">{ui.verdictOk}</p>
        <p className="place">{lastCountryName || campaign.title}</p>
        <p className="xp-line">+{campaign.reward} XP</p>
        <p className="gq-ticket-copy">{ui.nextTask}</p>
      </div>
    )
  }

  if (phase === "campaignComplete") {
    return (
      <div className="gq-mastery" data-result="campaign">
        <Fireworks />
        <p className="kicker">{ui.campaignDone}</p>
        <h2>{ui.geoGame}</h2>
        <p className="gq-mastery-rank">{ui.greatJob}</p>
        <p>{ui.campaignWrap}</p>
        <p className="gq-mastery-earn">
          {ui.reward}: <AnimatedXp target={progress.xp} />
        </p>
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
