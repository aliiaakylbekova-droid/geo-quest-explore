import { useEffect } from "react"
import { GameShell } from "./game/GameShell"
import { ContinentPick } from "./screens/ContinentPick"
import { RegisterScreen } from "./screens/RegisterScreen"
import { useGame, type Stage } from "./store/gameStore"

export default function App() {
  const hydrate = useGame((s) => s.hydrate)
  const ready = useGame((s) => s.ready)
  const stage = useGame((s) => s.stage)
  const locale = useGame((s) => s.progress.locale)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    window.geoQuestDebug = {
      fly: (lat, lng, dist) => useGame.getState().fly(lat, lng, dist),
      stage: (s) => useGame.getState().setStage(s as Stage),
      landmark: (id) => useGame.getState().openLandmark(id),
      pick: (iso, lat, lng) => useGame.getState().pick({ iso, lat, lng }),
      continue: () => useGame.getState().continueCampaign(),
      retry: () => useGame.getState().retryLevel(),
      campaign: (index) => useGame.getState().startCampaign(index),
      flag: () => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Флаги") || b.textContent?.includes("FLAGS"))
        btn?.click()
      },
      flagTarget: () => useGame.getState().mission?.targetIso ?? null,
      flagHit: () => {
        const m = useGame.getState().mission
        if (!m?.targetIso) return
        useGame.getState().pick({ iso: m.targetIso, lat: m.lat ?? 0, lng: m.lng ?? 0 })
      },
      flagMiss: () => {
        useGame.getState().pick({ iso: "XX", lat: 0, lng: 0 })
      },
      flagUnlocked: () => useGame.getState().progress.flagUnlocked,
      flyTarget: () => {
        const m = useGame.getState().mission
        if (m?.lat != null) useGame.getState().fly(m.lat, m.lng ?? 0, 3.9)
      },
      timeout: () => {
        useGame.setState({ missionEndsAt: Date.now() - 1 })
        useGame.getState().tickTimeout()
      },
      coins: () => useGame.getState().progress.coins,
      skipTutorial: () => {
        localStorage.setItem("gq-tutorial-done", "1")
      },
      finishIntro: () => useGame.getState().finishIntro(),
      daily: () => useGame.getState().openDaily(),
      toast: () => useGame.getState().toast?.text ?? null,
      hub: () => useGame.getState().setStage("hub"),
      puzzle: () => useGame.getState().openPuzzle(),
      continent: (id?: string) => useGame.getState().pickContinent(id || "Asia"),
    }
  }, [])

  void locale

  if (!ready) {
    return (
      <div className="boot">
        <p>GEO QUEST</p>
      </div>
    )
  }

  if (stage === "register") return <RegisterScreen />
  if (stage === "continent") return <ContinentPick />
  return <GameShell />
}
