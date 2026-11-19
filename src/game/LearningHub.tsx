import { CONTINENT_PHOTO, continentLabel } from "../data/continents"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"

export function LearningHub() {
  const progress = useGame((s) => s.progress)
  const profile = useGame((s) => s.profile)
  const setStage = useGame((s) => s.setStage)
  const openDaily = useGame((s) => s.openDaily)
  const playDailyTask = useGame((s) => s.playDailyTask)
  const openPuzzle = useGame((s) => s.openPuzzle)
  const openJourney = useGame((s) => s.openJourneyPick)
  const ui = t().play
  const photo = `${import.meta.env.BASE_URL}textures/earth-day.jpg`
  const cont = progress.learningContinent
  const pos = CONTINENT_PHOTO[cont] ?? CONTINENT_PHOTO.Asia
  const done = progress.dailyTasks.filter((task) => task.done).length
  const next = progress.dailyTasks.find((task) => !task.done)

  return (
    <aside className="gq-hub" data-hub="1">
      <div
        className="gq-hub-photo"
        style={{
          backgroundImage: `url(${photo})`,
          backgroundPosition: `${pos.x} ${pos.y}`,
          backgroundSize: pos.size,
        }}
      />
      <p className="kicker">{ui.hub}</p>
      <h2>{ui.hubWelcome.replace("{name}", profile?.name || "исследователь")}</h2>
      <p className="gq-hub-area">
        {ui.learningArea}: <b>{continentLabel(cont)}</b>
      </p>
      <div className="gq-hub-stats">
        <span>{progress.xp} XP</span>
        <span>
          {ui.streak} {progress.questStreak}
        </span>
        <span>
          {ui.daily} {done}/{progress.dailyTasks.length || 3}
        </span>
      </div>
      <ul className="gq-daily-list gq-hub-dailies">
        {progress.dailyTasks.slice(0, 3).map((task) => (
          <li key={task.id}>
            <button type="button" className={task.done ? "chip on" : "chip"} disabled={task.done} onClick={() => playDailyTask(task.id)}>
              {task.title}
            </button>
            <span>{task.goal}</span>
          </li>
        ))}
      </ul>
      {progress.weekly.length ? (
        <div className="gq-weekly">
          <p className="tiny">{ui.weekly}</p>
          {progress.weekly.map((w) => (
            <p key={w.id} className={`tiny${w.done ? " ok" : ""}`}>
              {w.title}: {Math.min(w.count, w.goal)}/{w.goal}
            </p>
          ))}
        </div>
      ) : null}
      <div className="gq-hub-modes">
        <button type="button" className="intro-start intro-journey" onClick={() => openJourney()}>
          {ui.geoJourney}
        </button>
        <button type="button" className="btn" onClick={() => setStage("explore")}>
          {ui.explore}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            useGame.setState({ mission: null })
            useGame.getState().setStage("flag")
          }}
        >
          {ui.flags}
        </button>
        <button type="button" className="btn" onClick={() => openPuzzle()}>
          {ui.puzzle}
        </button>
        <button type="button" className="btn" onClick={() => (next ? playDailyTask(next.id) : openDaily())}>
          {ui.daily}
        </button>
      </div>
    </aside>
  )
}
