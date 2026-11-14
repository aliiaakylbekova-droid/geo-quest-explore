import { useState } from "react"
import { audio } from "../audio/AudioManager"
import { GlobeMap } from "../game/GlobeMap"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"

export function RegisterScreen() {
  const register = useGame((s) => s.register)
  const [name, setName] = useState("")
  const [step, setStep] = useState<"nick" | "go">("nick")
  const [leaving, setLeaving] = useState(false)
  const canStart = name.trim().length >= 2
  const ui = t().play

  function goJourney() {
    if (!canStart || leaving) return
    audio.unlock()
    audio.play("startClick")
    setLeaving(true)
    window.setTimeout(() => {
      void register(name, "ocean")
    }, 640)
  }

  return (
    <div className="intro-root" data-intro="card">
      <div className="hud-center intro-globe-dim">
        <GlobeMap onPick={() => undefined} />
      </div>
      <form
        className={leaving ? "intro-card is-out" : "intro-card"}
        onSubmit={(e) => {
          e.preventDefault()
          if (step === "nick" && canStart) setStep("go")
          else goJourney()
        }}
      >
        <h1>{ui.geoGame}</h1>
        {step === "nick" ? (
          <>
            <p className="intro-lead">{ui.askName}</p>
            <input
              className="intro-nick"
              value={name}
              maxLength={40}
              placeholder={ui.nickname}
              autoComplete="nickname"
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="intro-start" disabled={!canStart}>
              {ui.nickNext}
            </button>
          </>
        ) : (
          <>
            <p className="intro-lead">
              {ui.helloExplorer.replace("{name}", name.trim())}
            </p>
            <button type="submit" className="intro-start intro-journey">
              {ui.start}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
