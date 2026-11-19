import { t } from "../i18n"
import { useGame, type Progress } from "../store/gameStore"

const LEVELS: Progress["difficulty"][] = ["easy", "medium", "hard"]

export function DifficultyDock() {
  const chosen = useGame((s) => s.progress.difficulty)
  const round = useGame((s) => s.roundRules?.difficulty)
  const setDifficulty = useGame((s) => s.setDifficulty)
  const dict = t()
  const pending = Boolean(round && round !== chosen)
  return (
    <div className="hud-diff" data-difficulty={chosen}>
      <span className="hud-diff-label">{dict.mission.difficulty}</span>
      <div className="diff-row">
        {LEVELS.map((d) => (
          <button
            key={d}
            type="button"
            className={chosen === d ? "chip on" : "chip"}
            aria-pressed={chosen === d}
            onClick={() => setDifficulty(d)}
          >
            {dict.settings[d]}
          </button>
        ))}
      </div>
      {pending ? <p className="hud-diff-note">{dict.play.difficultyNext}</p> : null}
    </div>
  )
}
