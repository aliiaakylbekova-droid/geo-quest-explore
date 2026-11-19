import { isoOf, NEIGHBORS, type CountryRecord } from "../geo/catalog"
import { LEARNING_CONTINENTS, type LearningContinent } from "./continents"

export const ATLAS_PALETTE = [
  "#e07a6a",
  "#8fd9b6",
  "#c5b4e8",
  "#f0d56a",
  "#f08a4a",
  "#4ec5c1",
  "#e8a0c0",
  "#9dcc7a",
] as const

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
  color: string
  x0: number
  y0: number
  x1: number
  y1: number
}

function hashIso(iso: string) {
  let n = 0
  for (let i = 0; i < iso.length; i += 1) n = (n * 33 + iso.charCodeAt(i)) >>> 0
  return n
}

function boxesTouch(a: PuzzlePiece, b: PuzzlePiece) {
  const pad = 10
  return !(a.x1 + pad < b.x0 || b.x1 + pad < a.x0 || a.y1 + pad < b.y0 || b.y1 + pad < a.y0)
}

export function colorAtlas(pieces: PuzzlePiece[]): PuzzlePiece[] {
  const byIso = new Map(pieces.map((p) => [p.iso, p]))
  const graph = new Map<string, Set<string>>()
  for (const p of pieces) graph.set(p.iso, new Set())
  for (const p of pieces) {
    for (const n of NEIGHBORS[p.iso] ?? []) {
      if (byIso.has(n)) graph.get(p.iso)!.add(n)
    }
  }
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const a = pieces[i]
      const b = pieces[j]
      if (!boxesTouch(a, b)) continue
      graph.get(a.iso)!.add(b.iso)
      graph.get(b.iso)!.add(a.iso)
    }
  }
  const order = [...pieces].sort((a, b) => (graph.get(b.iso)?.size ?? 0) - (graph.get(a.iso)?.size ?? 0))
  const chosen = new Map<string, string>()
  for (const p of order) {
    const used = new Set([...graph.get(p.iso)!].map((iso) => chosen.get(iso)).filter(Boolean) as string[])
    const start = hashIso(p.iso) % ATLAS_PALETTE.length
    let color = ATLAS_PALETTE[start]
    for (let k = 0; k < ATLAS_PALETTE.length; k += 1) {
      const cand = ATLAS_PALETTE[(start + k) % ATLAS_PALETTE.length]
      if (!used.has(cand)) {
        color = cand
        break
      }
    }
    chosen.set(p.iso, color)
  }
  return pieces.map((p) => ({ ...p, color: chosen.get(p.iso) ?? p.color }))
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
      color: ATLAS_PALETTE[hashIso(iso) % ATLAS_PALETTE.length],
      x0: built.x0,
      y0: built.y0,
      x1: built.x1,
      y1: built.y1,
    })
  }
  return colorAtlas(out)
}

function pathFromFeature(feature: GeoJSON.Feature, box: PuzzleBounds) {
  const geom = feature.geometry
  if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) {
    return { d: "", cx: 0, cy: 0, n: 0, x0: 0, y0: 0, x1: 0, y1: 0 }
  }
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates
  let d = ""
  let sx = 0
  let sy = 0
  let n = 0
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
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
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    })
    d += "Z"
  }
  return { d, cx: n ? sx / n : 0, cy: n ? sy / n : 0, n, x0: Number.isFinite(x0) ? x0 : 0, y0: Number.isFinite(y0) ? y0 : 0, x1: Number.isFinite(x1) ? x1 : 0, y1: Number.isFinite(y1) ? y1 : 0 }
}
