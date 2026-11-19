import { useEffect, useMemo, useRef, useState } from "react"
import "../index.css"
import { audio } from "../audio/AudioManager"
import { TutorialOverlay, tutorialDone } from "../screens/TutorialOverlay"
import { ACHIEVEMENTS } from "../data/achievements"
import { GEO_CAMPAIGN } from "../data/campaign"
import { CONTINENT_RU, type LearningContinent } from "../data/continents"
import { CONTINENTS, shiftDate, todayKey } from "../data/daily"
import { LANDMARKS, NEIGHBORS, getCatalog, loadCatalog } from "../geo/catalog"
import { formatClock } from "./logic"
import { CampaignOverlay } from "./CampaignOverlay"
import { DifficultyDock } from "./DifficultyDock"
import { filterCountryPool } from "./difficulty"
import { HintLadder } from "./MissionHints"
import { GeoJourneyLayer } from "./GeoJourney"
import { LearningHub } from "./LearningHub"
import { MapPuzzle } from "./MapPuzzle"
import { t } from "../i18n"
import { CompassGlobeWordmark } from "../ui/CompassGlobe"
import { FLAG_MODES, STORY_MISSIONS, type StoryMission } from "./storyMissions"
import { ContinentPick } from "../screens/ContinentPick"
import { StageView } from "../three/StageView"
import { useGame } from "../store/gameStore"

function FlagImg({ iso }: { iso: string }) {
  return (
    <img
      className="flag-xl"
      src={`${import.meta.env.BASE_URL}flags/${iso.toLowerCase()}.svg`}
      alt={`Флаг ${iso}`}
    />
  )
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.2h3.1L12 5.2v13.6L7.1 14.8H4z" />
      {on ? (
        <>
          <path d="M15.6 9.1c1.15 1.05 1.75 2.4 1.75 3.9s-.6 2.85-1.75 3.9" fill="none" />
          <path d="M18.2 6.6c1.9 1.85 2.9 4.2 2.9 6.4s-1 4.55-2.9 6.4" fill="none" />
        </>
      ) : (
        <path d="M4.2 4.2l15.6 15.6" fill="none" />
      )}
    </svg>
  )
}

function useTick(endsAt: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endsAt) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [endsAt])
  return endsAt ? Math.max(0, endsAt - now) : 0
}

function countryName(iso: string | null) {
  if (!iso) return "—"
  return getCatalog()?.byIso.get(iso)?.name ?? iso
}

export function GameShell() {
  const stage = useGame((s) => s.stage)
  const setStage = useGame((s) => s.setStage)
  const pick = useGame((s) => s.pick)
  const profile = useGame((s) => s.profile)
  const progress = useGame((s) => s.progress)
  const selectedIso = useGame((s) => s.selectedIso)
  const layers = useGame((s) => s.layers)
  const setLayers = useGame((s) => s.setLayers)
  const landmarkId = useGame((s) => s.landmarkId)
  const openLandmark = useGame((s) => s.openLandmark)
  const mission = useGame((s) => s.mission)
  const startMission = useGame((s) => s.startMission)
  const clearMission = useGame((s) => s.clearMission)
  const missionEndsAt = useGame((s) => s.missionEndsAt)
  const lastFeedback = useGame((s) => s.lastFeedback)
  const lastHit = useGame((s) => s.lastHit)
  const introPhase = useGame((s) => s.introPhase)
  const finishIntro = useGame((s) => s.finishIntro)
  const campaign = useGame((s) => s.campaign)
  const campaignPhase = useGame((s) => s.campaignPhase)
  const startCampaign = useGame((s) => s.startCampaign)
  const tickTimeout = useGame((s) => s.tickTimeout)
  const lastCountryName = useGame((s) => s.lastCountryName)
  const hitTint = useGame((s) => s.hitTint)
  const screenFlash = useGame((s) => s.screenFlash)
  const toast = useGame((s) => s.toast)
  const rewardPulse = useGame((s) => s.rewardPulse)
  const displayXp = useGame((s) => s.displayXp)
  const openDaily = useGame((s) => s.openDaily)
  const playDailyTask = useGame((s) => s.playDailyTask)
  const openPuzzle = useGame((s) => s.openPuzzle)
  const journey = useGame((s) => s.journey)
  const finishJourneyPuzzle = useGame((s) => s.finishJourneyPuzzle)
  const clearToast = useGame((s) => s.clearToast)
  const roundRules = useGame((s) => s.roundRules)
  const hideNames = (stage === "mission" || Boolean(campaign)) && Boolean(roundRules) && !roundRules.showNames
  const [point, setPoint] = useState<{ title: string; text: string } | null>(null)
  const [flagRound, setFlagRound] = useState<StoryMission | null>(null)
  const [hoverTip, setHoverTip] = useState<{ name: string; capital: string | null; x: number; y: number } | null>(null)
  const [coach, setCoach] = useState(() => !tutorialDone())
  const [moreOpen, setMoreOpen] = useState(false)
  const [hudMin, setHudMin] = useState(false)
  const [exitAsk, setExitAsk] = useState(false)
  const [changeCont, setChangeCont] = useState(false)
  const exitToPlaque = useGame((s) => s.exitToPlaque)
  const lastTickSec = useRef<number | null>(null)
  const left = useTick(missionEndsAt)
  const clockOn = Boolean(missionEndsAt) && !journey && (Boolean(campaign) || stage === "flag" || stage === "mission")

  function requestExit() {
    setMoreOpen(false)
    if (clockOn && left > 0) setExitAsk(true)
    else exitToPlaque()
  }

  function dismissCountry() {
    useGame.setState({ selectedIso: null, lastCountryName: null })
  }

  useEffect(() => {
    void loadCatalog().then(() => useGame.getState().reseedDaily())
  }, [])

  useEffect(() => {
    if (introPhase !== "approach") return
    const id = window.setTimeout(() => finishIntro(), 3400)
    return () => window.clearTimeout(id)
  }, [introPhase, finishIntro])

  useEffect(() => {
    if (introPhase !== "ready") return
    audio.unlock()
    audio.play("ambient")
  }, [introPhase])

  useEffect(() => {
    if (left > 0 || !missionEndsAt || campaignPhase === "timeout") return
    if (campaign || stage === "flag" || stage === "mission") tickTimeout()
  }, [left, campaign, stage, campaignPhase, missionEndsAt, tickTimeout])

  useEffect(() => {
    if (!clockOn || left <= 0 || campaignPhase === "timeout") {
      lastTickSec.current = null
      return
    }
    const sec = Math.ceil(left / 1000)
    if (sec === lastTickSec.current) return
    const prev = lastTickSec.current
    lastTickSec.current = sec
    if (prev === null) return
    audio.play(sec <= 10 ? "tickWarn" : "tick")
  }, [clockOn, left, campaignPhase])

  const country = selectedIso ? getCatalog()?.byIso.get(selectedIso) : undefined
  const landmark = LANDMARKS.find((l) => l.id === landmarkId) ?? LANDMARKS[0]
  const localMarks = LANDMARKS.filter((l) => !selectedIso || l.country === selectedIso)

  function judge(hit: { iso: string | null; lat: number; lng: number }) {
    pick(hit)
  }

  const flagPool = useMemo(() => {
    const all = getCatalog()?.countries.filter((c) => c.iso.length === 2 && c.continent !== "Antarctica") ?? []
    const filtered = filterCountryPool(all, progress.difficulty)
    const home = journey?.continent || progress.learningContinent
    const scoped = home ? filtered.filter((c) => c.continent === home) : filtered
    return scoped.length >= 6 ? scoped : filtered.length ? filtered : all
  }, [stage, selectedIso, progress.learningContinent, progress.difficulty, journey?.continent])

  function newFlagRound(kind: (typeof FLAG_MODES)[number] = "flag") {
    if (useGame.getState().journey) return
    const pool = flagPool.length ? flagPool : [{ iso: "KG", name: "Кыргызстан", capital: "Бишкек", lat: 41.2, lng: 74.6, continent: "Asia", a3: "KGZ", nameEn: "Kyrgyzstan", subregion: "", pop: 0 }]
    const c = pool[Math.floor(Math.random() * pool.length)]
    const neighbors = (NEIGHBORS[c.iso] || []).map((iso) => getCatalog()?.byIso.get(iso)?.name ?? iso).join(", ")
    const stories: Record<string, StoryMission> = {
      flag: {
        id: `flag-${c.iso}`,
        kind: "flag",
        title: "Охотник за флагами",
        story: "Перед тобой флаг. Найди страну на карте мира.",
        goal: "Кликни страну, которой принадлежит этот флаг.",
        hint: `Столица: ${c.capital || "—"}. Материк: ${CONTINENT_RU[c.continent] ?? c.continent}.`,
        recap: `Это ${c.name}. Столица — ${c.capital}.`,
        timeMs: 50_000,
        xp: 90,
        targetIso: c.iso,
        targetName: c.name,
        lat: c.lat,
        lng: c.lng,
      },
      capital: {
        id: `cap-${c.iso}`,
        kind: "capital",
        title: "Найди по столице",
        story: `Столица называется ${c.capital || "не указана"}. Где эта страна?`,
        goal: "Кликни страну на глобусе.",
        hint: `Регион: ${c.subregion || c.continent}.`,
        recap: `${c.capital} — столица страны ${c.name}.`,
        timeMs: 50_000,
        xp: 90,
        targetIso: c.iso,
        targetName: c.name,
        lat: c.lat,
        lng: c.lng,
      },
      coords: {
        id: `xy-${c.iso}`,
        kind: "coords",
        title: "Найди по координатам",
        story: `Широта ${c.lat.toFixed(1)}°, долгота ${c.lng.toFixed(1)}°.`,
        goal: "Кликни эту точку / страну на карте.",
        hint: "Сначала найди широту (север-юг), затем долготу.",
        recap: `Точка лежит в стране ${c.name}.`,
        timeMs: 55_000,
        xp: 100,
        targetIso: c.iso,
        targetName: c.name,
        lat: c.lat,
        lng: c.lng,
      },
      neighbors: {
        id: `nb-${c.iso}`,
        kind: "neighbors",
        title: "Соседи",
        story: neighbors ? `Эта страна граничит с: ${neighbors}.` : `${c.name} — узнай её по положению на материке ${c.continent}.`,
        goal: "Кликни страну-ответ на карте.",
        hint: c.continent,
        recap: `${c.name} и её соседи помогают читать политическую карту.`,
        timeMs: 60_000,
        xp: 110,
        targetIso: c.iso,
        targetName: c.name,
        lat: c.lat,
        lng: c.lng,
      },
      shape: {
        id: `sh-${c.iso}`,
        kind: "shape",
        title: "Узнай контур",
        story: "На карте подсвечен контур. Найди, какая это страна, и подтверди кликом по ней.",
        goal: "Кликни ту же страну.",
        hint: `${c.continent}. Столица: ${c.capital}.`,
        recap: `Контур принадлежит стране ${c.name}.`,
        timeMs: 45_000,
        xp: 80,
        targetIso: c.iso,
        targetName: c.name,
        lat: c.lat,
        lng: c.lng,
      },
    }
    const round = stories[kind]
    setFlagRound(round)
    startMission(round)
    if (kind === "shape") useGame.setState({ highlightIso: c.iso })
  }

  useEffect(() => {
    if (stage !== "flag") {
      setFlagRound(null)
      return
    }
    if (mission?.kind === "flag" && mission.targetIso) setFlagRound(mission)
    else if (journey) setFlagRound(mission)
    else if (!mission || (mission.kind !== "flag" && !mission.id.startsWith("daily-"))) newFlagRound("flag")
  }, [stage, mission?.id, mission?.kind])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => clearToast(), 2400)
    return () => window.clearTimeout(id)
  }, [toast, clearToast])

  useEffect(() => {
    if (stage !== "flag" || !lastFeedback?.ok || !mission) return
    if (mission.id.startsWith("daily-") || mission.id.startsWith("journey-")) return
    const id = window.setTimeout(() => newFlagRound("flag"), 4200)
    return () => window.clearTimeout(id)
  }, [stage, lastFeedback?.ok, mission?.id])

  useEffect(() => {
    if (!lastFeedback?.ok || !mission?.id.startsWith("daily-")) return
    const next = progress.dailyTasks.find((task) => !task.done)
    const wait = stage === "flag" ? 4200 : 2200
    const id = window.setTimeout(() => {
      if (next) playDailyTask(next.id)
      else openDaily()
    }, wait)
    return () => window.clearTimeout(id)
  }, [lastFeedback?.ok, mission?.id, progress.dailyTasks, playDailyTask, openDaily, stage])

  useEffect(() => {
    if (stage !== "mission" || campaign || !lastFeedback?.ok || !mission) return
    const idx = STORY_MISSIONS.findIndex((m) => m.id === mission.id)
    const next = idx >= 0 ? STORY_MISSIONS[idx + 1] : undefined
    if (!next) return
    const id = window.setTimeout(() => startMission(next), 720)
    return () => window.clearTimeout(id)
  }, [stage, lastFeedback?.ok, mission?.id, campaign, startMission])

  const discover = stage === "discover"
  const ui = t().play
  const dict = t()
  void progress.locale
  const missionIndex = campaign?.number ?? (mission ? Math.max(1, STORY_MISSIONS.findIndex((m) => m.id === mission.id) + 1) : stage === "explore" ? 0 : 1)
  const level = campaign?.number ?? Math.floor(displayXp / 120) + 1
  const xpInto = displayXp % 120
  const missionProgress = Math.min(1, (progress.campaignDone.length || progress.missionsDone.length) / GEO_CAMPAIGN.length)

  const leftTitle = campaign
    ? campaign.title
    : stage === "explore"
      ? ui.explore
      : stage === "hub"
        ? ui.hub
        : stage === "puzzle"
          ? ui.puzzle
          : stage === "discover"
        ? ui.discover
        : stage === "journal"
          ? ui.journal
          : stage === "daily"
            ? ui.daily
            : stage === "settings"
              ? dict.settings.title
              : mission?.title ?? ui.missions
  const leftBrief = campaign
    ? campaign.instruction
    : stage === "explore"
      ? "Вращай Землю, приближай, кликай страны. Двойной клик — подлёт. Сначала смотри, потом задание."
      : stage === "hub"
        ? ui.pickContinentLead
        : stage === "puzzle"
          ? ui.puzzleBrief
      : stage === "discover"
        ? landmark?.fact
        : stage === "journal"
          ? "Записи экспедиции."
          : stage === "daily"
            ? ui.dailyBrief
            : stage === "settings"
              ? ui.settingsBrief
              : mission?.story
  const catalog = getCatalog()
  const continentProgress = CONTINENTS.map((cont) => {
    const total = catalog?.countries.filter((c) => c.continent === cont && c.iso.length === 2).length ?? 0
    const have = progress.visited.filter((iso) => catalog?.byIso.get(iso)?.continent === cont).length
    return { cont, have, total, label: CONTINENT_RU[cont] ?? cont }
  })
  const calDays = Array.from({ length: 35 }, (_, i) => shiftDate(todayKey(), i - 34))

  return (
    <div
      className={`gq-live hud intro-${introPhase}${screenFlash === "red" ? " is-flash-red" : ""}${hudMin ? " is-hud-min" : ""}`}
      data-hud="explorer-v2"
      data-intro={introPhase}
      data-stage={stage}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("button, select")) audio.play("startClick")
      }}
    >
      {screenFlash === "red" ? <div className="gq-flash-red" aria-hidden /> : null}
      <header className="hud-top">
        <div className="brand">
          <CompassGlobeWordmark compact />
          <span className="pilot">{profile?.name}</span>
        </div>
        {clockOn ? (
          <div className={`hud-clock${left <= 10000 ? " is-warn" : ""}`} aria-live="polite">
            {formatClock(left)}
          </div>
        ) : null}
        <div className={`hud-xp${rewardPulse ? " is-reward" : ""}`}>
          <span>
            {ui.level} {level}
          </span>
          <span className="sep" />
          <span>{displayXp} XP</span>
          <span className="sep" />
          <span>
            {ui.streak} {progress.questStreak || progress.playStreak}
          </span>
          <span className="sep" />
          <span>◆ {progress.coins}</span>
        </div>
        <button type="button" className="hud-exit" onClick={requestExit}>
          {ui.exit}
        </button>
      </header>

      <button
        type="button"
        className={`hud-speaker${progress.musicOn ? "" : " is-muted"}`}
        aria-pressed={progress.musicOn}
        aria-label={progress.musicOn ? ui.musicMute : ui.musicUnmute}
        title={progress.musicOn ? ui.musicMute : ui.musicUnmute}
        onClick={() => useGame.getState().toggleMusic()}
      >
        <SpeakerIcon on={progress.musicOn} />
      </button>

      <div className="hud-stack" id="gq-hud-stack">
      <aside className="hud-left">
        <article className="mission-card" key={stage + (mission?.id ?? "")}>
            <p className="mission-no">
              {ui.level} {String(missionIndex).padStart(2, "0")}
            </p>
            <h3>{leftTitle}</h3>
            <p className="brief">{leftBrief}</p>
            {campaign ? (
              <>
                <p className="goal mission-prompt">
                  <span>{ui.task}</span>
                  {campaign.goal}
                </p>
                <p className="xp-reward">+{campaign.reward} XP</p>
              </>
            ) : null}
            {(stage === "mission" || stage === "flag") && mission && !campaign ? (
            <>
              <p className="goal mission-prompt">
                <span>{ui.goal}</span>
                {mission.goal}
              </p>
              {mission.xp ? <p className="xp-reward">+{mission.xp} XP</p> : null}
            </>
          ) : null}
          {stage === "explore" ? (
            <p className="goal">
              <span>{ui.goal}</span>
              {journey?.leg === "explore" && journey.targetIso
                ? ui.findCountry.replace("{name}", countryName(journey.targetIso))
                : "Изучи территорию. Двойной клик по стране — подлёт. Имена крупнее вдали, мельче вблизи."}
            </p>
          ) : null}
          {journey?.leg === "explore" ? (
            <p className="xp-reward">{ui.exploreCount.replace("{n}", String(journey.exploreCorrect))}</p>
          ) : null}
          {journey?.leg === "flags" ? (
            <p className="xp-reward">{ui.flagsStreak.replace("{n}", String(journey.flagsStreak))}</p>
          ) : null}
          {stage === "hub" ? (
            <p className="goal">
              <span>{ui.myLearning}</span>
              {CONTINENT_RU[progress.learningContinent] ?? progress.learningContinent} · {progress.continentXp} XP
            </p>
          ) : null}
          {stage === "puzzle" ? (
            <p className="goal">
              <span>{ui.goal}</span>
              {ui.puzzleBrief}
            </p>
          ) : null}
          {stage === "discover" && landmark ? (
            <>
              {point ? (
                <div className="recap">
                  <strong>{point.title}</strong>
                  <p>{point.text}</p>
                </div>
              ) : (
                <p className="goal">
                  <span>{ui.goal}</span>
                  Кликай золотые точки на сцене.
                </p>
              )}
              <button type="button" className="btn" onClick={() => setStage("mission")}>
                К миссии по территории
              </button>
            </>
          ) : null}
          {stage === "flag" && mission && lastFeedback && !lastFeedback.ok ? (
            <p className="bad">{lastFeedback.text}</p>
          ) : null}
          {stage === "mission" && mission && lastFeedback ? (
            <>
              <p className={lastFeedback.ok ? "ok" : "bad"}>{lastFeedback.text}</p>
              {lastFeedback.ok ? <p className="recap">{mission.recap}</p> : null}
            </>
          ) : null}
          {stage === "journal" ? (
            <div className="gq-collection">
              <p className="tiny gq-awards-head">
                <CompassGlobeWordmark compact />
                {ui.opened}: {progress.visited.length} · {ui.loginStreak}: {progress.loginStreak}
              </p>
              <div className="gq-cont-list">
                {continentProgress.map((row) => (
                  <p key={row.cont} className="tiny">
                    {row.label}: {row.have}/{row.total || "—"}
                  </p>
                ))}
              </div>
              <div className="gq-open-flags">
                {progress.visited.slice(0, 24).map((iso) => (
                  <img key={iso} src={`${import.meta.env.BASE_URL}flags/${iso.toLowerCase()}.svg`} alt={iso} />
                ))}
              </div>
              <ul className="journal">
                {ACHIEVEMENTS.map((a) => (
                  <li key={a.id} className={progress.achievements.includes(a.id) ? "ok" : ""}>
                    {a.title}
                    {progress.achievements.includes(a.id) ? " ✓" : ` — ${a.hint}`}
                  </li>
                ))}
              </ul>
              {progress.journal.length === 0 ? null : (
                <ul className="journal">
                  {progress.journal.map((j) => (
                    <li key={j.at}>{j.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          {stage === "daily" ? (
            <div className="gq-daily">
              <p className="tiny">
                {ui.streak}: {progress.questStreak} · {ui.loginStreak}: {progress.loginStreak} · {progress.dailyComplete ? ui.dailyDone : `${progress.dailyTasks.filter((task) => task.done).length}/${progress.dailyTasks.length}`}
              </p>
              <div className="gq-cal" aria-label={ui.loginStreak}>
                {calDays.map((d) => (
                  <i key={d} className={progress.loginDates.includes(d) ? "on" : ""} title={d} />
                ))}
              </div>
              <ul className="gq-daily-list">
                {progress.dailyTasks.map((task) => (
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
                    <p key={w.id} className="tiny">
                      {w.title}: {Math.min(w.count, w.goal)}/{w.goal}
                      {w.done ? " ✓" : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {stage === "settings" ? (
            <div className="audio-set">
              <label className="audio-row">
                <span>{ui.sfx}</span>
                <input type="checkbox" checked={progress.sfxOn} onChange={(e) => useGame.getState().setSfx(e.target.checked)} />
              </label>
              <input type="range" min={0} max={1} step={0.05} value={progress.sfxVol} onChange={(e) => useGame.getState().setSfxVol(Number(e.target.value))} />
              <DifficultyDock />
              <p className="tiny">
                {ui.learningArea}: {CONTINENT_RU[progress.learningContinent] ?? (progress.learningContinent || "—")}
              </p>
              <button type="button" className="chip" onClick={() => setChangeCont(true)}>
                {ui.changeContinent}
              </button>
            </div>
          ) : null}
          <div className="mission-progress">
            <span>{ui.progress}</span>
            <div className="bar">
              <i style={{ width: `${Math.round(missionProgress * 100)}%` }} />
            </div>
          </div>
        </article>
        <div className="hud-peek">
          <div className="hud-hint-row" id="gq-hint-row" hidden={hudMin}>
            <HintLadder />
          </div>
          <button
            type="button"
            className="hud-chrome-toggle"
            aria-expanded={!hudMin}
            aria-controls="gq-hint-row"
            onClick={() => {
              setHudMin((v) => !v)
              setMoreOpen(false)
            }}
          >
            {hudMin ? ui.showHud : ui.hideHud}
          </button>
        </div>
      </aside>

      <aside className="hud-right">
        {stage === "flag" && flagRound?.targetIso ? (
          <div className="flag-hunt">
            <p>{ui.clickFlag}</p>
            <FlagImg iso={flagRound.targetIso} />
            {flagRound.kind !== "flag" ? <p className="tiny">{flagRound.story}</p> : null}
          </div>
        ) : null}
        {campaign && campaignPhase === "play" && !journey ? (
          <div className="timer-xl" key={campaign.id}>
            {formatClock(left)}
          </div>
        ) : (stage === "mission" || stage === "flag") && mission && !campaign && !journey ? (
          <div className="timer-xl" key={mission.id}>
            {formatClock(left)}
          </div>
        ) : (
          <div className="timer-idle">{journey ? ui.geoJourney : campaign ? ui.missions : ui.explore}</div>
        )}
        <DifficultyDock />
        <div className="stat-stack">
          <div className="stat">
            <span>{ui.level}</span>
            <b>{level}</b>
          </div>
          <div className={`xp-track${rewardPulse ? " is-reward" : ""}`}>
            <span>
              XP {displayXp} · {xpInto}/120
              {rewardPulse ? ` · +${rewardPulse}` : ""}
            </span>
            <div className="bar">
              <i style={{ width: `${(xpInto / 120) * 100}%` }} />
            </div>
          </div>
          <div className="stat">
            <span>{ui.score}</span>
            <b>◆ {progress.coins}</b>
          </div>
        </div>
        {stage !== "flag" && country ? (
          <div className="country-card" key={country.iso}>
            <img className="flag-sm" src={`${import.meta.env.BASE_URL}flags/${country.iso.toLowerCase()}.svg`} alt="" />
            <h3>{country.name}</h3>
            <p>
              {ui.capital}: {country.capital || "—"}
            </p>
            <p>
              {country.continent} · {country.lat.toFixed(1)}°, {country.lng.toFixed(1)}°
            </p>
            {NEIGHBORS[country.iso] ? (
              <p>
                {ui.neighbors}: {NEIGHBORS[country.iso].map(countryName).join(", ")}
              </p>
            ) : null}
            {localMarks.map((lm) => (
              <button key={lm.id} type="button" className="chip" onClick={() => openLandmark(lm.id)}>
                {lm.name}
              </button>
            ))}
          </div>
        ) : null}
        {stage !== "flag" && !country ? <p className="tiny">{ui.hoverHint}</p> : null}
        {lastHit ? (
          <p className="tiny">
            {ui.cursor}: {lastHit.lat.toFixed(1)}°, {lastHit.lng.toFixed(1)}°
          </p>
        ) : null}
        <div className="layers">
          {(
            [
              ["relief", "Рельеф"],
              ["rivers", "Реки"],
              ["borders", "Границы"],
              ["capitals", "Столицы"],
              ["climate", "Климат"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={layers[k] ? "layer-sw on" : "layer-sw"}
              aria-pressed={layers[k]}
              onClick={() => setLayers({ [k]: !layers[k] })}
            >
              <span className="layer-knob" />
              {label}
            </button>
          ))}
        </div>
      </aside>
      </div>

      <main className="hud-center">
        {stage === "puzzle" ? (
          journey?.leg === "puzzle" ? (
            <MapPuzzle
              lockedContinent={journey.continent as LearningContinent}
              lockedDiff="easy"
              hideChrome
              skipXp
              onComplete={(xp, leftover) => finishJourneyPuzzle(xp, leftover)}
            />
          ) : (
            <MapPuzzle />
          )
        ) : (
        <StageView
          discover={discover}
          scene={landmark.scene}
          onPick={judge}
          onPoint={(title, text) => setPoint({ title, text })}
          onHover={(hit) => {
            if (!hit?.name) setHoverTip(null)
            else if (hideNames)
              setHoverTip(null)
            else
              setHoverTip({
                name: hit.name,
                capital: stage === "flag" ? hit.capital : null,
                x: hit.x,
                y: hit.y,
              })
          }}
        />
        )}
        {stage === "hub" && !journey ? <LearningHub /> : null}
        {!hideNames && hoverTip ? (
          <div className="gq-tip" style={{ left: hoverTip.x, top: hoverTip.y }}>
            <span>{hoverTip.name}</span>
            {hoverTip.capital ? <em className="gq-tip-cap">{hoverTip.capital}</em> : null}
          </div>
        ) : null}
        {stage === "flag" && lastCountryName ? (
          <div className={`gq-select-chip tint-${hitTint || "gold"}`}>{lastCountryName}</div>
        ) : !hideNames && stage !== "flag" && lastCountryName && (hitTint === "gold" || hitTint === "cyan" || selectedIso) ? (
          <div className={`gq-select-chip tint-${hitTint || "cyan"}`}>{lastCountryName}</div>
        ) : !hideNames && stage !== "flag" && country ? (
          <div className="gq-select-chip">{country.name}</div>
        ) : null}
      </main>

      <nav className={`hud-bottom${moreOpen ? " is-more" : ""}`}>
        <div className="hud-nav-main">
          <button
            type="button"
            className={stage === "explore" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              setStage("explore")
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" />
            </svg>
            <span>{ui.explore}</span>
          </button>
          <button
            type="button"
            className={stage === "discover" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              if (landmarkId) setStage("discover")
              else openLandmark("issyk")
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>{ui.discover}</span>
          </button>
          <button
            type="button"
            className={stage === "mission" || Boolean(campaign) ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              setStage("mission")
              startCampaign(progress.campaignIndex < GEO_CAMPAIGN.length ? progress.campaignIndex : 0)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h10l-2 4 2 4H6v8" />
            </svg>
            <span>{ui.missions}</span>
          </button>
          <button
            type="button"
            className={stage === "flag" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              newFlagRound("flag")
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4v16M6 4h10l-2 4 2 4H6" />
            </svg>
            <span>{ui.flags}</span>
          </button>
          <button
            type="button"
            className={`hud-more-toggle${moreOpen || stage === "journal" || stage === "settings" ? " on" : ""}`}
            aria-expanded={moreOpen}
            aria-label={ui.more}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="6" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="18" cy="12" r="1.6" />
            </svg>
            <span>{ui.more}</span>
          </button>
        </div>
        <div className="hud-nav-sheet">
          <select
            className="mission-select"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              const story = STORY_MISSIONS.find((m) => m.id === v)
              if (story) startMission(story)
              if (FLAG_MODES.includes(v as (typeof FLAG_MODES)[number])) newFlagRound(v as (typeof FLAG_MODES)[number])
              e.target.selectedIndex = 0
              setMoreOpen(false)
            }}
          >
            <option value="" disabled>
              {ui.assignment}
            </option>
            {STORY_MISSIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
            <option value="flag">Охотник: флаг</option>
            <option value="capital">Охотник: столица</option>
            <option value="coords">Охотник: координаты</option>
            <option value="neighbors">Охотник: соседи</option>
            <option value="shape">Охотник: контур</option>
          </select>
          <button
            type="button"
            className={stage === "hub" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              setStage("hub")
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11l8-7 8 7v9H4z" />
            </svg>
            <span>{ui.hub}</span>
          </button>
          <button
            type="button"
            className={stage === "puzzle" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              openPuzzle()
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
            </svg>
            <span>{ui.puzzle}</span>
          </button>
          <button
            type="button"
            className={stage === "daily" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              openDaily()
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="6" width="14" height="13" rx="1" />
              <path d="M8 4v4M16 4v4M5 10h14" />
            </svg>
            <span>{ui.daily}</span>
          </button>
          <button
            type="button"
            className={stage === "journal" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              setStage("journal")
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="4" width="12" height="16" rx="1" />
              <path d="M9 8h6M9 12h6M9 16h4" />
            </svg>
            <span>{ui.journal}</span>
          </button>
          <button
            type="button"
            className={stage === "settings" ? "on" : ""}
            onClick={() => {
              setMoreOpen(false)
              setStage("settings")
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
            </svg>
            <span>{ui.profile}</span>
          </button>
          {(stage === "mission" || stage === "flag") && mission && !journey ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setMoreOpen(false)
                clearMission()
              }}
            >
              <span>{ui.surrender}</span>
            </button>
          ) : null}
          <button type="button" className="hud-exit hud-exit-sheet" onClick={requestExit}>
            <span>{ui.exit}</span>
          </button>
        </div>
      </nav>

      {toast ? (
        <div className={`gq-toast tint-${toast.kind}`} role="status">
          <strong>{toast.kind === "ach" ? ui.congrats : ui.greatJob}</strong>
          <p>{toast.text}</p>
        </div>
      ) : null}

      {stage === "explore" && country ? (
        <div className="country-pop-root">
          <aside className="country-pop" role="dialog" aria-labelledby="country-pop-title">
            <button type="button" className="country-pop-x" onClick={dismissCountry}>
              {dict.common.close}
            </button>
            <img
              className="country-pop-flag"
              src={`${import.meta.env.BASE_URL}flags/${country.iso.toLowerCase()}.svg`}
              alt=""
            />
            <h3 id="country-pop-title">{country.name}</h3>
            <p>
              {ui.capital}: {country.capital || "—"}
            </p>
          </aside>
        </div>
      ) : null}

      {exitAsk ? (
        <div className="gq-tutorial" data-exit="confirm">
          <article className="gq-tutorial-card">
            <p className="kicker">{ui.geoGame}</p>
            <h2>{ui.exitConfirmTitle}</h2>
            <p className="gq-tutorial-lead">{ui.exitConfirmBody}</p>
            <div className="gq-exit-actions">
              <button type="button" className="intro-start intro-journey" onClick={() => exitToPlaque()}>
                {ui.exitYes}
              </button>
              <button type="button" className="btn ghost" onClick={() => setExitAsk(false)}>
                {ui.exitNo}
              </button>
            </div>
          </article>
        </div>
      ) : null}
      <GeoJourneyLayer />
      <CampaignOverlay />
      {introPhase === "ready" && coach ? <TutorialOverlay onDone={() => setCoach(false)} /> : null}
      {changeCont ? (
        <div className="gq-tutorial" data-continent="change">
          <button type="button" className="btn ghost gq-cont-close" onClick={() => setChangeCont(false)}>
            {dict.common.close}
          </button>
          <ContinentPick changing onPicked={() => setChangeCont(false)} />
        </div>
      ) : null}
    </div>
  )
}
