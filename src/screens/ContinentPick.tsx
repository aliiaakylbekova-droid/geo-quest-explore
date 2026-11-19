import { GlobeMap } from "../game/GlobeMap"
import { CONTINENT_PHOTO, LEARNING_CONTINENTS, continentLabel } from "../data/continents"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"

export function ContinentPick({ changing = false, onPicked }: { changing?: boolean; onPicked?: () => void }) {
  const pickContinent = useGame((s) => s.pickContinent)
  const ui = t().play
  const photo = `${import.meta.env.BASE_URL}textures/earth-day.jpg`

  return (
    <div className={changing ? "gq-continent-pick is-overlay" : "intro-root gq-continent-pick"} data-continent-pick="1">
      {changing ? null : (
        <div className="hud-center intro-globe-dim">
          <GlobeMap onPick={() => undefined} />
        </div>
      )}
      <form
        className="intro-card start-plaque gq-continent-card"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="kicker">{ui.geoGame}</p>
        <h1>{ui.pickContinent}</h1>
        <p className="intro-lead">{ui.pickContinentLead}</p>
        <div className="gq-continent-grid">
          {LEARNING_CONTINENTS.map((id) => {
            const pos = CONTINENT_PHOTO[id]
            return (
              <button
                key={id}
                type="button"
                className="gq-continent-tile"
                onClick={() => {
                  pickContinent(id)
                  onPicked?.()
                }}
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
      </form>
    </div>
  )
}
