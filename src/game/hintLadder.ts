import type { CampaignLevel } from "../data/campaign"
import { getCatalog, LANDMARKS, type CountryRecord } from "../geo/catalog"
import { t } from "../i18n"
import type { StoryMission } from "./storyMissions"

export const CONTINENT_RU: Record<string, string> = {
  Asia: "Азия",
  Europe: "Европа",
  Africa: "Африка",
  "North America": "Северная Америка",
  "South America": "Южная Америка",
  Oceania: "Океания",
  Antarctica: "Антарктида",
  Eurasia: "Евразия",
}

export type ExtraHintKind = "continent" | "letter" | "capital" | "pulse" | "reveal"

export type ExtraHintStep = {
  kind: ExtraHintKind
  text: string
  lat?: number
  lng?: number
  pulseIsos: string[]
}

export type HintTarget = {
  iso?: string
  name?: string
  continent?: string
  capital?: string
  landmark?: string
  lat?: number
  lng?: number
  subregion?: string
}

function firstLetter(name: string) {
  const ch = [...name].find((c) => /\p{L}/u.test(c))
  return (ch ?? name.slice(0, 1)).toLocaleUpperCase("ru-RU")
}

function countryOf(iso?: string): CountryRecord | undefined {
  if (!iso) return undefined
  return getCatalog()?.byIso.get(iso)
}

function pulseIsosFor(iso?: string, lat?: number, lng?: number, continent?: string) {
  const cat = getCatalog()
  if (!cat) return iso ? [iso] : []
  const rec = iso ? cat.byIso.get(iso) : undefined
  const region = rec?.subregion
  let pool = cat.countries.filter((c) => c.iso.length === 2 && c.iso !== "AQ")
  if (region) pool = pool.filter((c) => c.subregion === region)
  else if (rec?.continent || continent) {
    const cont = rec?.continent || continent
    pool = pool.filter((c) => c.continent === cont)
  } else if (lat != null && lng != null) {
    pool = pool
      .map((c) => ({ c, d: (c.lat - lat) ** 2 + (c.lng - lng) ** 2 }))
      .filter((x) => x.d < 80)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.c)
  }
  const ranked = [...pool].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
  const isos: string[] = []
  if (iso) isos.push(iso)
  for (const c of ranked) {
    if (!isos.includes(c.iso)) isos.push(c.iso)
    if (isos.length >= 8) break
  }
  return isos
}

export function hintTargetOf(mission: StoryMission | null, campaign: CampaignLevel | null): HintTarget {
  if (mission?.targetIso) {
    const rec = countryOf(mission.targetIso)
    const mark = LANDMARKS.find((l) => l.country === mission.targetIso)
    return {
      iso: mission.targetIso,
      name: rec?.name ?? mission.targetName,
      continent: rec?.continent,
      capital: rec?.capital,
      landmark: mark?.name,
      lat: rec?.lat ?? mission.lat,
      lng: rec?.lng ?? mission.lng,
      subregion: rec?.subregion,
    }
  }
  if (campaign) {
    const check = campaign.check
    if (check.type === "iso") {
      const rec = countryOf(check.iso)
      const mark = LANDMARKS.find((l) => l.country === check.iso)
      return {
        iso: check.iso,
        name: rec?.name ?? campaign.title,
        continent: rec?.continent,
        capital: rec?.capital,
        landmark: mark?.name,
        lat: rec?.lat ?? campaign.fly.lat,
        lng: rec?.lng ?? campaign.fly.lng,
        subregion: rec?.subregion,
      }
    }
    if (check.type === "continent") {
      return {
        name: CONTINENT_RU[check.continent] ?? check.continent,
        continent: check.continent,
        lat: campaign.fly.lat,
        lng: campaign.fly.lng,
      }
    }
    const iso = "iso" in check ? check.iso : check.type === "river" || check.type === "range" ? check.isos[0] : undefined
    const rec = countryOf(iso)
    const lat = "lat" in check ? check.lat : campaign.fly.lat
    const lng = "lng" in check ? check.lng : campaign.fly.lng
    const mark = iso ? LANDMARKS.find((l) => l.country === iso) : undefined
    return {
      iso,
      name: rec?.name ?? campaign.title,
      continent: rec?.continent,
      capital: rec?.capital,
      landmark: mark?.name,
      lat,
      lng,
      subregion: rec?.subregion,
    }
  }
  if (mission?.kind === "continent") {
    return {
      name: mission.continent ?? "Евразия",
      continent: "Eurasia",
      lat: 42,
      lng: 60,
    }
  }
  if (mission) {
    const mark = mission.targetName
    return {
      name: mission.targetName,
      continent: mission.kind === "river" ? "Africa" : mission.kind === "mountain" ? "Asia" : undefined,
      landmark: mark,
      lat: mission.lat,
      lng: mission.lng,
    }
  }
  return {}
}

export function buildExtraHints(mission: StoryMission | null, campaign: CampaignLevel | null): ExtraHintStep[] {
  const ui = t().play
  const target = hintTargetOf(mission, campaign)
  const continentLabel = target.continent ? (CONTINENT_RU[target.continent] ?? target.continent) : undefined
  const pulseIsos = pulseIsosFor(target.iso, target.lat, target.lng, target.continent)
  const steps: ExtraHintStep[] = []

  if (continentLabel) {
    steps.push({
      kind: "continent",
      text: ui.hintContinent.replace("{name}", continentLabel),
      lat: target.lat,
      lng: target.lng,
      pulseIsos: [],
    })
  }

  const letterSrc = target.name || target.capital
  if (letterSrc) {
    steps.push({
      kind: "letter",
      text: ui.hintLetter.replace("{letter}", firstLetter(letterSrc)),
      pulseIsos: [],
    })
  }

  if (target.capital) {
    steps.push({
      kind: "capital",
      text: ui.hintCapital.replace("{name}", target.capital),
      pulseIsos: [],
    })
  } else if (target.landmark) {
    steps.push({
      kind: "capital",
      text: ui.hintLandmark.replace("{name}", target.landmark),
      pulseIsos: [],
    })
  }

  if (target.lat != null && target.lng != null) {
    steps.push({
      kind: "pulse",
      text: ui.hintPulse,
      lat: target.lat,
      lng: target.lng,
      pulseIsos,
    })
  }

  if (target.name) {
    steps.push({
      kind: "reveal",
      text: ui.hintReveal.replace("{name}", target.name),
      pulseIsos: [],
    })
  }

  return steps
}

export function baseHintText(mission: StoryMission | null, campaign: CampaignLevel | null) {
  return mission?.hint ?? campaign?.hint ?? ""
}
