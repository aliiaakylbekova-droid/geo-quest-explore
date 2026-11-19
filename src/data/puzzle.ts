import { isoOf, type CountryRecord } from "../geo/catalog"
import { LEARNING_CONTINENTS, type LearningContinent } from "./continents"

export type PuzzleDiff = "easy" | "medium" | "hard"

export type PuzzleBounds = { west: number; east: number; south: number; north: number }

export const PUZZLE_BOUNDS: Record<LearningContinent, PuzzleBounds> = {
  Asia: { west: 26, east: 152, south: -12, north: 78 },
  Europe: { west: -14, east: 42, south: 34, north: 72 },
  Africa: { west: -20, east: 52, south: -36, north: 38 },
  "North America": { west: -170, east: -52, south: 7, north: 72 },
  "South America": { west: -82, east: -34, south: -56, north: 13 },
  Oceania: { west: 110, east: 180, south: -48, north: 2 },
}

const EASY: Record<LearningContinent, string[]> = {
  Asia: ["CN", "IN", "KZ", "MN", "SA", "IR", "ID", "JP", "TH", "PK"],
  Europe: ["FR", "DE", "ES", "IT", "UA", "PL", "SE", "GB", "RO", "NO"],
  Africa: ["DZ", "LY", "EG", "SD", "ET", "NG", "CD", "ZA", "AO", "ML"],
  "North America": ["CA", "US", "MX", "GL", "CU", "GT"],
  "South America": ["BR", "AR", "PE", "CO", "BO", "VE", "CL"],
  Oceania: ["AU", "PG", "NZ", "FJ"],
}

const MEDIUM_EXTRA: Record<LearningContinent, string[]> = {
  Asia: ["AF", "IQ", "YE", "MM", "VN", "KR", "UZ", "MY", "PH", "TR"],
  Europe: ["TR", "GR", "BY", "FI", "PT", "HU", "AT", "CZ", "BG", "IE"],
  Africa: ["MA", "NE", "TD", "KE", "TZ", "MZ", "NA", "CM", "GH", "MG"],
  "North America": ["HN", "NI", "PA", "CR", "DO", "HT", "JM"],
  "South America": ["EC", "PY", "UY", "GY", "SR"],
  Oceania: ["FJ", "NC", "SB", "VU"],
}

export const PUZZLE_SIZE = { w: 1000, h: 620 }

export function puzzleIsos(
  continent: LearningContinent,
  diff: PuzzleDiff,
  countries: CountryRecord[],
): string[] {
  if (diff === "hard") {
    return countries
      .filter((c) => c.continent === continent && c.iso.length === 2 && c.iso !== "RU")
      .map((c) => c.iso)
  }
  const easy = EASY[continent]
  if (diff === "easy") return easy
  const extra = MEDIUM_EXTRA[continent]
  const set = new Set([...easy, ...extra])
  return [...set]
}

export function nextPuzzleLevel(continent: LearningContinent, diff: PuzzleDiff): { continent: LearningContinent; diff: PuzzleDiff } {
  if (diff === "easy") return { continent, diff: "medium" }
  if (diff === "medium") return { continent, diff: "hard" }
  const i = LEARNING_CONTINENTS.indexOf(continent)
  const next = LEARNING_CONTINENTS[(i + 1) % LEARNING_CONTINENTS.length]
  return { continent: next, diff: "easy" }
}

export function puzzleKey(continent: string, diff: PuzzleDiff) {
  return `${continent}:${diff}`
}

export function puzzleTimeMs(diff: PuzzleDiff) {
  return diff === "easy" ? 180_000 : diff === "medium" ? 150_000 : 120_000
}

export function puzzleXp(diff: PuzzleDiff, leftoverMs: number) {
  const base = diff === "easy" ? 90 : diff === "medium" ? 130 : 180
  return base + Math.min(40, Math.round(leftoverMs / 4000))
}

function unwrapRing(ring: number[][]): [number, number][] {
  if (ring.length < 2) return []
  const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring
  if (!pts.length) return []
  let prev = pts[0][0]
  const out: [number, number][] = []
  for (const p of pts) {
    let lng = p[0]
    while (lng - prev > 180) lng -= 360
    while (prev - lng > 180) lng += 360
    prev = lng
    out.push([lng, p[1]])
  }
  return out
}

export function project(lng: number, lat: number, box: PuzzleBounds, w = PUZZLE_SIZE.w, h = PUZZLE_SIZE.h) {
  return {
    x: ((lng - box.west) / (box.east - box.west)) * w,
    y: ((box.north - lat) / (box.north - box.south)) * h,
  }
}

export type PuzzlePiece = {
  iso: string
  name: string
  d: string
  cx: number
  cy: number
}

export function piecesFromFeatures(
  features: GeoJSON.Feature[],
  isos: string[],
  countries: CountryRecord[],
  box: PuzzleBounds,
): PuzzlePiece[] {
  const want = new Set(isos)
  const byIso = new Map(countries.map((c) => [c.iso, c]))
  const out: PuzzlePiece[] = []
  for (const feature of features) {
    const iso = isoOf(feature)
    if (!want.has(iso)) continue
    const built = pathFromFeature(feature, box)
    if (!built.d || built.n < 8) continue
    out.push({
      iso,
      name: byIso.get(iso)?.name ?? iso,
      d: built.d,
      cx: built.cx,
      cy: built.cy,
    })
  }
  return out
}

function pathFromFeature(feature: GeoJSON.Feature, box: PuzzleBounds) {
  const geom = feature.geometry
  if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) {
    return { d: "", cx: 0, cy: 0, n: 0 }
  }
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates
  let d = ""
  let sx = 0
  let sy = 0
  let n = 0
  for (const poly of polygons) {
    const ring = unwrapRing((poly[0] || []) as number[][])
    if (ring.length < 3) continue
    const midLng = ring.reduce((a, p) => a + p[0], 0) / ring.length
    const midLat = ring.reduce((a, p) => a + p[1], 0) / ring.length
    if (midLng < box.west - 8 || midLng > box.east + 8 || midLat < box.south - 8 || midLat > box.north + 8) continue
    ring.forEach(([lng, lat], i) => {
      const p = project(lng, lat, box)
      d += `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`
      sx += p.x
      sy += p.y
      n += 1
    })
    d += "Z"
  }
  return { d, cx: n ? sx / n : 0, cy: n ? sy / n : 0, n }
}
