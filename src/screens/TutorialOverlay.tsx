import { t } from "../i18n"

export const TUTORIAL_KEY = "gq-tutorial-done"

export function tutorialDone() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1"
  } catch {
    return false
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1")
  } catch {
    /* ignore */
  }
}

export function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const ui = t().play
  return (
    <div className="gq-tutorial" data-tutorial="first">
      <article className="gq-tutorial-card">
        <p className="kicker">{ui.geoGame}</p>
        <h2>{ui.tutorialTitle}</h2>
        <p className="gq-tutorial-lead">{ui.tutorialLead}</p>
        <ul>
          <li>{ui.tutorialExplore}</li>
          <li>{ui.tutorialHunt}</li>
          <li>{ui.tutorialClick}</li>
          <li>{ui.tutorialTimer}</li>
        </ul>
        <button
          type="button"
          className="intro-start intro-journey"
          onClick={() => {
            markTutorialDone()
            onDone()
          }}
        >
          {ui.tutorialOk}
        </button>
      </article>
    </div>
  )
}
