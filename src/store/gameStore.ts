import { create } from "zustand"
import { audio } from "../audio/AudioManager"
import { GEO_CAMPAIGN, type CampaignLevel } from "../data/campaign"
import { buildDailyTasks, dailyToMission, shiftDate, todayKey, type DailyTask } from "../data/daily"
import { countryNameOf, continentOf, evaluateLevel, evaluateMission } from "../geo/hitTest"
import { getCatalog, LANDMARKS } from "../geo/catalog"
import type { StoryMission } from "../game/storyMissions"
import type { Locale } from "../i18n"
import { setLocale, t } from "../i18n"
import type { Layers } from "../three/EarthScene"
import { cloudPull, cloudPush, cloudResetProgress } from "../net/cloud"
import { publishScore } from "../net/leaderboard"
import type { Profile } from "../types/electron"

export type Stage = "register" | "explore" | "discover" | "mission" | "flag" | "journal" | "settings" | "daily"
export type ToastKind = "ok" | "xp" | "ach"
export type IntroPhase = "card" | "approach" | "ready"
export type CampaignPhase = "play" | "correct" | "success" | "wrong" | "timeout" | "levelComplete" | "campaignComplete" | "transition"
export type HitTint = "gold" | "cyan" | "red" | "orange" | null

let autoAdvanceTimer = 0
const TIMEOUT_PENALTY = 20

export type FlyTo = { lat: number; lng: number; dist: number } | null

export type Progress = {
  xp: number
  coins: number
  achievements: string[]
  stamps: string[]
  visited: string[]
  missionsDone: string[]
  journal: { at: number; text: string }[]
  difficulty: "easy" | "medium" | "hard"
  volume: number
  musicOn: boolean
  sfxOn: boolean
  musicVol: number
  sfxVol: number
  locale: Locale
  campaignIndex: number
  campaignDone: string[]
  loginStreak: number
  bestLoginStreak: number
  lastLoginDate: string
  loginDates: string[]
  playStreak: number
  bestPlayStreak: number
  dailyDate: string
  dailyTasks: DailyTask[]
  dailyComplete: boolean
}

const defaultProgress = (): Progress => ({
  xp: 0,
  coins: 0,
  achievements: [],
  stamps: [],
  visited: [],
  missionsDone: [],
  journal: [],
  difficulty: "medium",
  volume: 0.7,
  musicOn: true,
  sfxOn: true,
  musicVol: 0.32,
  sfxVol: 0.7,
  locale: "ru",
  campaignIndex: 0,
  campaignDone: [],
  loginStreak: 0,
  bestLoginStreak: 0,
  lastLoginDate: "",
  loginDates: [],
  playStreak: 0,
  bestPlayStreak: 0,
  dailyDate: "",
  dailyTasks: [],
  dailyComplete: false,
})

function ensureDaily(progress: Progress): Progress {
  const day = todayKey()
  const countries = getCatalog()?.countries ?? []
  if (progress.dailyDate === day && progress.dailyTasks.length) return progress
  return {
    ...progress,
    dailyDate: day,
    dailyTasks: buildDailyTasks(day, countries),
    dailyComplete: false,
  }
}

function touchLogin(progress: Progress): Progress {
  const day = todayKey()
  let next = progress
  if (progress.lastLoginDate !== day) {
    const dates = progress.loginDates.includes(day) ? progress.loginDates : [...progress.loginDates, day].slice(-120)
    const streak = progress.lastLoginDate && shiftDate(day, -1) === progress.lastLoginDate ? progress.loginStreak + 1 : 1
    next = {
      ...progress,
      lastLoginDate: day,
      loginDates: dates,
      loginStreak: streak,
      bestLoginStreak: Math.max(progress.bestLoginStreak, streak),
    }
  }
  return ensureDaily(next)
}

function playerLevel(xp: number) {
  return Math.floor(xp / 120) + 1
}

function grantMany(progress: Progress, ids: string[]) {
  let next = progress
  for (const id of ids) next = grant(next, id)
  return next
}

function achievementIdsFor(progress: Progress) {
  const ids: string[] = []
  if (progress.visited.length >= 10) ids.push("open-10")
  if (progress.visited.length >= 50) ids.push("open-50")
  if (progress.visited.length >= 100) ids.push("open-100")
  if (progress.playStreak >= 5) ids.push("streak-5")
  if (progress.playStreak >= 10) ids.push("streak-10")
  if (progress.loginStreak >= 3) ids.push("login-3")
  if (progress.xp >= 500) ids.push("xp-500")
  if (progress.xp >= 1500) ids.push("xp-1500")
  if (progress.dailyComplete) ids.push("daily-first")
  if (progress.missionsDone.length >= 1) ids.push("first-mission")
  const asia = progress.visited.filter((iso) => continentOf(iso) === "Asia").length
  if (asia >= 12) ids.push("asia-12")
  const silk = ["KG", "KZ", "UZ", "TJ", "TM"]
  if (silk.every((iso) => progress.visited.includes(iso))) ids.push("silk-road")
  if (progress.stamps.length >= 3) ids.push("collector")
  return ids
}

type GameState = {
  ready: boolean
  stage: Stage
  profile: Profile | null
  progress: Progress
  selectedIso: string | null
  highlightIso: string | null
  landmarkId: string | null
  layers: Layers
  flyTo: FlyTo
  lastHit: { lat: number; lng: number; iso: string | null } | null
  mission: StoryMission | null
  missionEndsAt: number | null
  lastFeedback: { ok: boolean; text: string } | null
  introPhase: IntroPhase
  campaign: CampaignLevel | null
  campaignPhase: CampaignPhase
  hitTint: HitTint
  spinBoost: number
  flagPins: string[]
  screenFlash: "red" | null
  flagMoment: "win" | "lose" | null
  lastPenalty: number
  displayXp: number
  lastCountryName: string | null
  advancing: boolean
  toast: { text: string; kind: ToastKind } | null
  rewardPulse: number
  activeDailyId: string | null
  hydrate: () => Promise<void>
  register: (name: string, avatar: string) => Promise<void>
  finishIntro: () => void
  setStage: (stage: Stage) => void
  pick: (hit: { iso: string | null; lat: number; lng: number }) => void
  setLayers: (partial: Partial<Layers>) => void
  openLandmark: (id: string) => void
  startMission: (mission: StoryMission) => void
  clearMission: () => void
  award: (xp: number, coins: number) => void
  note: (text: string) => void
  completeMission: (id: string) => void
  fly: (lat: number, lng: number, dist?: number) => void
  setFeedback: (ok: boolean, text: string) => void
  setDifficulty: (d: Progress["difficulty"]) => void
  setVolume: (v: number) => void
  setMusic: (on: boolean) => void
  setSfx: (on: boolean) => void
  setMusicVol: (v: number) => void
  setSfxVol: (v: number) => void
  setLocalePref: (locale: Locale) => void
  resetProgress: () => Promise<void>
  startCampaign: (index?: number) => void
  retryLevel: () => void
  continueCampaign: () => void
  tickTimeout: () => void
  restartAfterTimeout: () => void
  exitToPlaque: () => void
  syncAudio: () => void
  openDaily: () => void
  playDailyTask: (id: string) => void
  reseedDaily: () => void
  clearToast: () => void
}

async function persist(progress: Progress, profile?: Profile | null) {
  if (window.geoQuest) await window.geoQuest.saveProgress(progress)
  else localStorage.setItem("gq-progress", JSON.stringify(progress))
  const who = profile ?? useGame.getState().profile
  void cloudPush(who, progress)
}

function grant(progress: Progress, id: string) {
  if (progress.achievements.includes(id)) return progress
  return { ...progress, achievements: [...progress.achievements, id], coins: progress.coins + 25 }
}

export const useGame = create<GameState>((set, get) => ({
  ready: false,
  stage: "register",
  profile: null,
  progress: defaultProgress(),
  selectedIso: null,
  highlightIso: null,
  landmarkId: null,
  layers: { relief: true, rivers: true, borders: true, capitals: true, climate: false },
  flyTo: null,
  lastHit: null,
  mission: null,
  missionEndsAt: null,
  lastFeedback: null,
  introPhase: "card",
  campaign: null,
  campaignPhase: "play",
  hitTint: null,
  spinBoost: 0,
  flagPins: [],
  screenFlash: null,
  flagMoment: null,
  lastPenalty: 0,
  displayXp: 0,
  lastCountryName: null,
  advancing: false,
  toast: null,
  rewardPulse: 0,
  activeDailyId: null,

  hydrate: async () => {
    try {
      const api = window.geoQuest
      const withTime = async <T>(job: Promise<T> | undefined): Promise<T | null> => {
        if (!job) return null
        return Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), 2000))])
      }
      const profile =
        (await withTime(api?.getProfile())) ??
        (localStorage.getItem("gq-profile") ? (JSON.parse(localStorage.getItem("gq-profile")!) as Profile) : null)
      const saved = ((await withTime(api?.getProgress() as Promise<Progress> | undefined)) ??
        (localStorage.getItem("gq-progress") ? JSON.parse(localStorage.getItem("gq-progress")!) : null)) as Progress | null
      let progress = touchLogin(saved ? { ...defaultProgress(), ...saved } : defaultProgress())
      let nextProfile = profile
      if (!nextProfile) {
        const cloud = await cloudPull()
        if (cloud.profile) {
          nextProfile = cloud.profile
          if (cloud.progress) progress = touchLogin({ ...defaultProgress(), ...cloud.progress })
          if (window.geoQuest) {
            await window.geoQuest.saveProfile(nextProfile)
            await window.geoQuest.saveProgress(progress)
          } else {
            localStorage.setItem("gq-profile", JSON.stringify(nextProfile))
            localStorage.setItem("gq-progress", JSON.stringify(progress))
          }
        }
      } else {
        void cloudPush(nextProfile, progress)
      }
      setLocale(progress.locale)
      audio.setMaster(progress.volume)
      audio.setMusic(progress.musicOn)
      audio.setSfx(progress.sfxOn)
      audio.setMusicVol(progress.musicVol)
      audio.setSfxVol(progress.sfxVol)
      set({
        profile: nextProfile,
        progress,
        displayXp: progress.xp,
        ready: true,
        stage: "register",
        introPhase: "card",
      })
    } catch {
      set({ ready: true, stage: "register", progress: defaultProgress(), introPhase: "card" })
    }
  },

  register: async (name, avatar) => {
    const profile: Profile = { name: name.trim().slice(0, 40), avatar, createdAt: Date.now() }
    if (window.geoQuest) await window.geoQuest.saveProfile(profile)
    else localStorage.setItem("gq-profile", JSON.stringify(profile))
    const progress = grant(get().progress, "first-step")
    await persist(progress, profile)
    audio.unlock()
    audio.play("ambient")
    set({ profile, progress, displayXp: progress.xp, stage: "explore", introPhase: "approach" })
  },

  finishIntro: () => {
    if (get().introPhase === "ready") return
    set({ introPhase: "ready" })
  },

  setStage: (stage) => {
    let progress = get().progress
    if (stage === "explore") progress = grant(progress, "globe-spin")
    const home = stage === "explore" && get().stage !== "explore"
    set({
      stage,
      campaign: stage === "mission" ? get().campaign : null,
      lastFeedback: null,
      flyTo: home ? { lat: 25, lng: 12, dist: 6.5 } : get().flyTo,
      ...(home
        ? {
            selectedIso: null,
            highlightIso: null,
            lastHit: null,
            lastCountryName: null,
            mission: null,
            missionEndsAt: null,
          }
        : {}),
    })
    void persist(progress)
    if (progress !== get().progress) set({ progress })
  },

  pick: (hit) => {
    audio.unlock()
    const st = get()
    if (st.introPhase !== "ready") return
    if (st.stage === "discover") return
    const busy = st.campaignPhase === "correct" || st.campaignPhase === "success" || st.campaignPhase === "transition"
    if (busy && st.stage !== "flag") return

    const isNewCountry = Boolean(hit.iso && !st.progress.visited.includes(hit.iso))
    const visited =
      hit.iso && !st.progress.visited.includes(hit.iso) ? [...st.progress.visited, hit.iso] : st.progress.visited
    let progress = { ...st.progress, visited }
    const name = countryNameOf(hit.iso)
    void persist(progress)

    const useFlag = st.stage === "flag" && st.mission
    const useStory = !useFlag && st.mission && st.stage === "mission" && !st.campaign
    const useCampaign = !useFlag && st.campaign && st.campaignPhase === "play"
    const useDaily = Boolean(st.activeDailyId && st.mission && (useFlag || useStory))

    if (!useFlag && !useStory && !useCampaign) {
      if (isNewCountry) {
        audio.play("unlock")
        progress = { ...progress, xp: progress.xp + 15, coins: progress.coins + 10 }
        progress = grantMany(progress, achievementIdsFor(progress))
      }
      set({
        selectedIso: hit.iso,
        lastHit: hit,
        lastCountryName: name,
        progress,
        displayXp: progress.xp,
        flyTo: hit.iso ? { lat: hit.lat, lng: hit.lng, dist: 3.85 } : st.flyTo,
        toast: isNewCountry ? { text: t().play.openedCountry, kind: "ok" } : st.toast,
        highlightIso: hit.iso,
        rewardPulse: isNewCountry ? 15 : 0,
      })
      void persist(progress)
      return
    }

    if (st.missionEndsAt && Date.now() >= st.missionEndsAt && (useCampaign || useFlag || useStory)) {
      audio.play("fail")
      set({
        selectedIso: hit.iso,
        lastHit: hit,
        lastCountryName: name,
        progress,
        campaignPhase: useCampaign ? "timeout" : st.campaignPhase,
        hitTint: "orange",
        lastFeedback: { ok: false, text: t().play.timesUp },
      })
      return
    }

    let ok = false
    let fact = ""
    let reward = 80
    if (useFlag || useStory) {
      ok = evaluateMission(st.mission!, hit)
      fact = st.mission!.recap
      reward = st.mission!.xp
    } else if (useCampaign) {
      ok = evaluateLevel(st.campaign!, hit)
      fact = st.campaign!.fact
      reward = st.campaign!.reward
    }

    if (ok) {
      audio.play("success")
      audio.play("discovery")
      if (st.mission && (useFlag || useStory)) {
        get().completeMission(st.mission.id)
        get().note(`${st.mission.title}: ${st.mission.recap}`)
      }
      const pins =
        useFlag && hit.iso && !st.flagPins.includes(hit.iso) ? [...st.flagPins, hit.iso] : st.flagPins
      const playStreak = progress.playStreak + 1
      const streakBonus = Math.min(40, Math.max(0, (playStreak - 1) * 6))
      const openBonus = isNewCountry ? 25 : 0
      const diffBonus = progress.difficulty === "hard" ? 15 : progress.difficulty === "easy" ? 0 : 8
      const gained = reward + streakBonus + openBonus + diffBonus
      const beforeLevel = playerLevel(progress.xp)
      let scored: Progress = {
        ...progress,
        xp: progress.xp + gained,
        coins: progress.coins + 20 + (isNewCountry ? 10 : 0),
        playStreak,
        bestPlayStreak: Math.max(progress.bestPlayStreak, playStreak),
      }
      if (useDaily && st.activeDailyId) {
        const dailyTasks = scored.dailyTasks.map((task) => (task.id === st.activeDailyId ? { ...task, done: true } : task))
        const dailyComplete = dailyTasks.every((task) => task.done)
        scored = { ...scored, dailyTasks, dailyComplete, xp: scored.xp + (dailyComplete && !progress.dailyComplete ? 80 : 0) }
      }
      const freshAch = achievementIdsFor(scored).filter((id) => !scored.achievements.includes(id))
      scored = grantMany(scored, achievementIdsFor(scored))
      if (freshAch.length) audio.play("achievement")
      if (isNewCountry) audio.play("unlock")
      if (playerLevel(scored.xp) > beforeLevel) audio.play("transition")
      const toastText = isNewCountry ? t().play.openedCountry : t().play.correctLocation
      set({
        selectedIso: hit.iso,
        highlightIso: hit.iso,
        lastHit: hit,
        lastCountryName: name,
        progress: scored,
        displayXp: scored.xp,
        campaignPhase: useCampaign ? "success" : st.campaignPhase,
        hitTint: "gold",
        spinBoost: 0,
        flagPins: pins,
        screenFlash: null,
        flagMoment: useFlag ? "win" : get().flagMoment,
        lastFeedback: { ok: true, text: toastText },
        flyTo: hit.iso ? { lat: hit.lat, lng: hit.lng, dist: 3.15 } : st.flyTo,
        toast: { text: toastText, kind: freshAch.length ? "ach" : "ok" },
        rewardPulse: gained,
        activeDailyId: useDaily && scored.dailyTasks.find((task) => task.id === st.activeDailyId)?.done ? null : st.activeDailyId,
      })
      for (let i = 0; i < 6; i += 1) window.setTimeout(() => audio.play("xp"), 80 * i)
      void persist(scored)
      if (useCampaign) {
        window.clearTimeout(autoAdvanceTimer)
        autoAdvanceTimer = window.setTimeout(() => {
          if (get().campaignPhase === "success") get().continueCampaign()
        }, 720)
      }
    } else {
      audio.play("fail")
      if (useFlag) audio.play("ambient")
      const hint = useFlag ? t().play.flagWrong : useCampaign ? st.campaign!.hint : st.mission?.hint || t().play.tryElsewhere
      const broken = { ...progress, playStreak: 0 }
      set({
        selectedIso: hit.iso,
        lastHit: hit,
        lastCountryName: name,
        progress: broken,
        campaignPhase: useCampaign ? "wrong" : st.campaignPhase,
        hitTint: "red",
        screenFlash: useFlag ? "red" : null,
        flagMoment: useFlag ? "lose" : get().flagMoment,
        lastFeedback: { ok: false, text: hint },
      })
      void persist(broken)
      if (useFlag) {
        window.setTimeout(() => {
          if (get().screenFlash === "red") set({ screenFlash: null })
        }, 2300)
      }
      window.setTimeout(() => {
        if (get().campaignPhase !== "wrong") return
        set({ campaignPhase: useCampaign ? "play" : get().campaignPhase, hitTint: null })
      }, 2200)
    }
    void fact
  },

  setLayers: (partial) => set({ layers: { ...get().layers, ...partial } }),

  openLandmark: (id) => {
    const lm = LANDMARKS.find((l) => l.id === id)
    if (!lm) return
    const stamps = get().progress.stamps.includes(id) ? get().progress.stamps : [...get().progress.stamps, id]
    const progress = { ...get().progress, stamps }
    set({
      landmarkId: id,
      selectedIso: lm.country,
      stage: "discover",
      flyTo: { lat: lm.lat, lng: lm.lng, dist: 3.1 },
      progress,
    })
    void persist(progress)
  },

  startMission: (mission) => {
    const bonus = get().progress.difficulty === "hard" ? 0.7 : get().progress.difficulty === "easy" ? 1.4 : 1
    const flagLike = mission.kind === "flag" || mission.kind === "capital" || mission.kind === "neighbors" || mission.kind === "shape"
    const daily = mission.id.startsWith("daily-")
    audio.play("transition")
    set({
      mission,
      campaign: flagLike || daily ? null : get().campaign,
      campaignPhase: "play",
      missionEndsAt: Date.now() + mission.timeMs * bonus,
      lastFeedback: null,
      flagMoment: null,
      lastPenalty: 0,
      highlightIso: flagLike || daily ? null : (mission.targetIso ?? null),
      stage: flagLike ? "flag" : "mission",
      activeDailyId: daily ? mission.id : null,
      toast: null,
      flyTo: flagLike || daily
        ? { lat: 22, lng: 18, dist: 6.6 }
        : mission.lat != null
          ? { lat: mission.lat, lng: mission.lng ?? 0, dist: 5.4 }
          : { lat: 20, lng: 30, dist: 6.5 },
    })
  },

  clearMission: () =>
    set({
      mission: null,
      missionEndsAt: null,
      highlightIso: null,
      lastFeedback: null,
      flagMoment: null,
      stage: "explore",
      flyTo: { lat: 18, lng: 20, dist: 6.5 },
    }),

  exitToPlaque: () => {
    window.clearTimeout(autoAdvanceTimer)
    set({
      stage: "register",
      introPhase: "card",
      campaign: null,
      campaignPhase: "play",
      mission: null,
      missionEndsAt: null,
      lastFeedback: null,
      hitTint: null,
      screenFlash: null,
      flagPins: [],
      flagMoment: null,
      lastPenalty: 0,
      advancing: false,
      flyTo: null,
      highlightIso: null,
    })
  },

  award: (xp, coins) => {
    let progress = { ...get().progress, xp: get().progress.xp + xp, coins: get().progress.coins + coins }
    if (progress.xp >= 500) progress = grant(progress, "xp-500")
    set({ progress })
    void persist(progress)
  },

  note: (text) => {
    const journal = [{ at: Date.now(), text }, ...get().progress.journal].slice(0, 40)
    const progress = { ...get().progress, journal }
    set({ progress })
    void persist(progress)
  },

  completeMission: (id) => {
    const progress = {
      ...get().progress,
      missionsDone: get().progress.missionsDone.includes(id) ? get().progress.missionsDone : [...get().progress.missionsDone, id],
    }
    set({ progress })
    void persist(progress)
  },

  fly: (lat, lng, dist = 4.1) => set({ flyTo: { lat, lng, dist } }),

  setFeedback: (ok, text) => set({ lastFeedback: { ok, text }, highlightIso: ok ? get().selectedIso : get().highlightIso }),

  setDifficulty: (d) => {
    const progress = { ...get().progress, difficulty: d }
    set({ progress })
    void persist(progress)
  },

  setVolume: (v) => {
    audio.setMaster(v)
    const progress = { ...get().progress, volume: v }
    set({ progress })
    void persist(progress)
  },

  setMusic: (on) => {
    audio.setMusic(on)
    const progress = { ...get().progress, musicOn: on }
    set({ progress })
    void persist(progress)
  },

  setSfx: (on) => {
    audio.setSfx(on)
    const progress = { ...get().progress, sfxOn: on }
    set({ progress })
    void persist(progress)
  },

  setMusicVol: (v) => {
    audio.setMusicVol(v)
    const progress = { ...get().progress, musicVol: v }
    set({ progress })
    void persist(progress)
  },

  setSfxVol: (v) => {
    audio.setSfxVol(v)
    const progress = { ...get().progress, sfxVol: v }
    set({ progress })
    void persist(progress)
  },

  syncAudio: () => {
    const p = get().progress
    audio.setMaster(p.volume)
    audio.setMusic(p.musicOn)
    audio.setSfx(p.sfxOn)
    audio.setMusicVol(p.musicVol)
    audio.setSfxVol(p.sfxVol)
  },

  openDaily: () => {
    const progress = touchLogin(get().progress)
    audio.play("transition")
    set({
      stage: "daily",
      progress,
      campaign: null,
      mission: null,
      missionEndsAt: null,
      lastFeedback: null,
      activeDailyId: null,
      flyTo: { lat: 20, lng: 24, dist: 6.4 },
    })
    void persist(progress)
  },

  playDailyTask: (id) => {
    const progress = ensureDaily(get().progress)
    const task = progress.dailyTasks.find((item) => item.id === id)
    if (!task || task.done) {
      set({ progress })
      return
    }
    const mission = dailyToMission(task)
    set({ progress })
    get().startMission(mission)
  },

  reseedDaily: () => {
    const countries = getCatalog()?.countries ?? []
    if (countries.length < 12) return
    const current = get().progress
    const keep = current.dailyDate === todayKey() && current.dailyTasks.length >= 12
    const progress = keep ? current : ensureDaily({ ...current, dailyTasks: [] })
    set({ progress })
    void persist(progress)
  },

  clearToast: () => set({ toast: null, rewardPulse: 0 }),

  startCampaign: (index) => {
    const i = Math.max(0, Math.min(GEO_CAMPAIGN.length - 1, index ?? get().progress.campaignIndex))
    const level = GEO_CAMPAIGN[i]
    const bonus = get().progress.difficulty === "hard" ? 0.75 : get().progress.difficulty === "easy" ? 1.35 : 1
    audio.play("transition")
    audio.play("zoom")
    set({
      campaign: level,
      campaignPhase: "play",
      hitTint: null,
      spinBoost: 0,
      lastFeedback: null,
      selectedIso: null,
      highlightIso: null,
      mission: null,
      stage: "mission",
      missionEndsAt: Date.now() + level.timeMs * bonus,
      flyTo: { ...level.fly },
      advancing: false,
    })
  },

  retryLevel: () => {
    const level = get().campaign
    if (!level) {
      get().startCampaign()
      return
    }
    const bonus = get().progress.difficulty === "hard" ? 0.75 : get().progress.difficulty === "easy" ? 1.35 : 1
    audio.play("transition")
    set({
      campaignPhase: "play",
      hitTint: null,
      lastFeedback: null,
      lastPenalty: 0,
      flagMoment: null,
      missionEndsAt: Date.now() + level.timeMs * bonus,
      flyTo: { ...level.fly },
    })
  },

  continueCampaign: () => {
    const level = get().campaign
    if (!level) return
    if (get().advancing) return
    if (get().campaignPhase !== "success" && get().campaignPhase !== "levelComplete") return
    window.clearTimeout(autoAdvanceTimer)
    set({ advancing: true })
    const done = get().progress.campaignDone.includes(level.id)
      ? get().progress.campaignDone
      : [...get().progress.campaignDone, level.id]
    const missionsDone = get().progress.missionsDone.includes(level.id)
      ? get().progress.missionsDone
      : [...get().progress.missionsDone, level.id]
    const nextIndex = level.number
    const last = nextIndex >= GEO_CAMPAIGN.length
    const progress = {
      ...get().progress,
      campaignDone: done,
      missionsDone,
      campaignIndex: last ? GEO_CAMPAIGN.length : nextIndex,
    }
    audio.play("unlock")
    if (last) {
      audio.play("missionComplete")
      set({
        progress,
        campaignPhase: "campaignComplete",
        hitTint: "gold",
        lastFeedback: { ok: true, text: t().play.campaignDone },
        advancing: false,
      })
      void persist(progress, get().profile)
      void publishScore({ name: get().profile?.name ?? "Игрок", score: progress.xp, at: Date.now() })
      return
    }
    const next = GEO_CAMPAIGN[nextIndex]
    audio.play("transition")
    audio.play("zoom")
    const bonus = progress.difficulty === "hard" ? 0.75 : progress.difficulty === "easy" ? 1.35 : 1
    void persist(progress)
    set({
      progress,
      campaign: next,
      campaignPhase: "play",
      hitTint: null,
      selectedIso: null,
      highlightIso: null,
      lastFeedback: null,
      missionEndsAt: Date.now() + next.timeMs * bonus,
      flyTo: { ...next.fly },
      stage: "mission",
      advancing: false,
    })
  },

  tickTimeout: () => {
    const st = get()
    if (st.campaignPhase === "timeout") return
    if (!st.missionEndsAt) return
    if (!st.campaign && !(st.mission && (st.stage === "flag" || st.stage === "mission"))) return
    audio.unlock()
    audio.play("timeout")
    window.setTimeout(() => audio.play("gameOver"), 380)
    audio.play("ambient")
    const progress = {
      ...st.progress,
      coins: Math.max(0, st.progress.coins - TIMEOUT_PENALTY),
      xp: Math.max(0, st.progress.xp - TIMEOUT_PENALTY),
    }
    set({
      campaignPhase: "timeout",
      hitTint: "orange",
      flagMoment: null,
      lastFeedback: { ok: false, text: t().play.timesUp },
      lastPenalty: TIMEOUT_PENALTY,
      progress,
      displayXp: progress.xp,
    })
    void persist(progress)
  },

  restartAfterTimeout: () => {
    const st = get()
    audio.play("startClick")
    if (st.campaign) {
      get().retryLevel()
      return
    }
    if (st.mission && (st.stage === "flag" || st.stage === "mission")) {
      get().startMission(st.mission)
    }
  },

  setLocalePref: (locale) => {
    setLocale(locale)
    const progress = { ...get().progress, locale }
    set({ progress })
    void persist(progress)
  },

  resetProgress: async () => {
    await window.geoQuest?.resetProgress()
    localStorage.removeItem("gq-progress")
    void cloudResetProgress()
    const progress = defaultProgress()
    set({
      progress,
      displayXp: 0,
      campaign: null,
      campaignPhase: "play",
      hitTint: null,
    })
    await persist(progress)
  },
}))
