import { CONTINENT_PHOTO, LEARNING_CONTINENTS, continentLabel } from "../data/continents"
import { JOURNEY_EXPLORE_GOAL, JOURNEY_FLAGS_GOAL, journeyXp } from "../data/journey"
import { formatClock } from "./logic"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"
import { CompassGlobeMark } from "../ui/CompassGlobe"

const LEGS = [
  { id: "explore", labelKey: "journeyExplore" as const },
  { id: "flags", labelKey: "journeyFlags" as const },
  { id: "puzzle", labelKey: "journeyPuzzle" as const },
] as const

function legIndex(leg: string) {
  if (leg === "explore") return 0
  if (leg === "inter-flags" || leg === "flags") return 1
  return 2
}

export function JourneyIndicator() {
  const journey = useGame((s) => s.journey)
  const ui = t().play
  if (!journey || journey.leg === "pick") return null
  const active = legIndex(journey.leg)
  return (
    <ol className="gq-journey-ind" data-journey-ind={journey.leg} aria-label={ui.geoJourney}>
      {LEGS.map((leg, i) => (
        <li key={leg.id} className={i === active ? "on" : i < active ? "done" : ""}>
          <span>{ui[leg.labelKey]}</span>
        </li>
      ))}
    </ol>
  )
}

export function GeoJourneyLayer() {
  const journey = useGame((s) => s.journey)
  const journeyPick = useGame((s) => s.journeyPick)
  const choose = useGame((s) => s.chooseJourneyContinent)
  const start = useGame((s) => s.startJourney)
  const cont = useGame((s) => s.continueJourney)
  const replay = useGame((s) => s.replayJourney)
  const other = useGame((s) => s.otherJourneyContinent)
  const home = useGame((s) => s.exitJourney)
  const profile = useGame((s) => s.profile)
  const ui = t().play
  const photo = `${import.meta.env.BASE_URL}textures/earth-day.jpg`

  if (!journey) return null

  if (journey.leg === "pick") {
    return (
      <div className="gq-journey-overlay is-pick" data-journey="pick">
        <article className="gq-journey-card">
          <p className="kicker">{ui.geoJourney}</p>
          <h1>{ui.whereToToday}</h1>
          <p className="intro-lead">{ui.whereToLead}</p>
          <div className="gq-continent-grid">
            {LEARNING_CONTINENTS.map((id) => {
              const pos = CONTINENT_PHOTO[id]
              return (
                <button
                  key={id}
                  type="button"
                  className={`gq-continent-tile${journeyPick === id ? " on" : ""}`}
                  onClick={() => choose(id)}
                >
                  <i
                    style={{
                      backgroundImage: `url(${photo})`,
                      backgroundPosition: `${pos.x} ${pos.y}`,
                      backgroundSize: pos.size,
                    }}
                  />
                  <span>{continentLabel(id)}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="intro-start intro-journey" disabled={!journeyPick} onClick={() => start()}>
            {ui.startJourney}
          </button>
        </article>
      </div>
    )
  }

  if (journey.leg === "inter-flags" || journey.leg === "inter-puzzle") {
    const flags = journey.leg === "inter-flags"
    return (
      <div className="gq-journey-overlay is-inter" data-journey={journey.leg}>
        <article className="gq-journey-card is-fade">
          <CompassGlobeMark size="lg" />
          <p className="kicker">{ui.geoJourney}</p>
          <h1>{flags ? ui.amazingFlags : ui.amazingPuzzle}</h1>
          <button type="button" className="intro-start intro-journey" onClick={() => cont()}>
            {ui.journeyNext}
          </button>
        </article>
      </div>
    )
  }

  if (journey.leg === "results") {
    const pos = CONTINENT_PHOTO[journey.continent] ?? CONTINENT_PHOTO.Asia
    const elapsed = Math.max(0, Date.now() - journey.startedAt)
    const xp = journey.xpPending || journeyXp(journey)
    return (
      <div className="gq-journey-overlay is-results" data-journey="results">
        <article className="gq-journey-card is-fade">
          <div
            className="gq-hub-photo"
            style={{
              backgroundImage: `url(${photo})`,
              backgroundPosition: `${pos.x} ${pos.y}`,
              backgroundSize: pos.size,
            }}
          />
          <p className="kicker">{ui.geoJourney}</p>
          <h1>{ui.journeyResults}</h1>
          <p className="gq-hub-area">
            {continentLabel(journey.continent)}
            {profile?.name ? ` · ${profile.name}` : ""}
          </p>
          <ul className="gq-journey-stats">
            <li>
              {ui.journeyExplore}: {journey.exploreCorrect}/{JOURNEY_EXPLORE_GOAL}
            </li>
            <li>
              {ui.journeyFlags}: {journey.flagsBest}/{JOURNEY_FLAGS_GOAL}
            </li>
            <li>
              {ui.puzzle}: {ui.puzzleWin}
            </li>
            <li>
              {ui.journeyTime}: {formatClock(elapsed)}
            </li>
            <li>
              {ui.streak}: {journey.flagsBest}
            </li>
            <li>
              XP +{xp}
            </li>
          </ul>
          <div className="gq-exit-actions">
            <button type="button" className="intro-start intro-journey" onClick={() => replay()}>
              {ui.playAgain}
            </button>
            <button type="button" className="btn" onClick={() => other()}>
              {ui.otherContinent}
            </button>
            <button type="button" className="btn ghost" onClick={() => home()}>
              {ui.home}
            </button>
          </div>
        </article>
      </div>
    )
  }

  return <JourneyIndicator />
}
