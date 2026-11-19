import { useEffect, useState } from "react"
import { audio } from "../audio/AudioManager"
import { GlobeMap } from "../game/GlobeMap"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"

function tryStartMusic() {
  audio.unlock()
  audio.play("ambient")
}

export function RegisterScreen() {
  const register = useGame((s) => s.register)
  const saved = useGame((s) => s.profile?.name ?? "")
  const [name, setName] = useState(saved)
  const [leaving, setLeaving] = useState(false)
  const canStart = name.trim().length >= 2
  const ui = t().play

  useEffect(() => {
    const kick = () => audio.unlock()
    window.addEventListener("pointerdown", kick, { once: true })
    window.addEventListener("keydown", kick, { once: true })
    return () => {
      window.removeEventListener("pointerdown", kick)
      window.removeEventListener("keydown", kick)
    }
  }, [])

  function goJourney() {
    if (!canStart || leaving) return
    tryStartMusic()
    audio.play("startClick")
    audio.play("start")
    setLeaving(true)
    window.setTimeout(() => {
      void register(name, "ocean")
    }, 640)
  }

  return (
    <div className="intro-root" data-intro="plaque">
      <div className="hud-center intro-globe-dim">
        <GlobeMap onPick={() => undefined} />
      </div>
      <form
        className={leaving ? "intro-card start-plaque is-out" : "intro-card start-plaque"}
        onSubmit={(e) => {
          e.preventDefault()
          goJourney()
        }}
      >
        <p className="kicker">{ui.geoGame}</p>
        <h1>{ui.beginGame}</h1>
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
        <button type="submit" className="intro-start intro-journey" disabled={!canStart}>
          {ui.beginGame}
        </button>
      </form>
    </div>
  )
}
