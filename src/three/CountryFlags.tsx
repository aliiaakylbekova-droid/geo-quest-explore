import { useEffect, useMemo, useState } from "react"
import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  SRGBColorSpace,
  type BufferGeometry,
} from "three"
import { isoOf, loadCatalog } from "../geo/catalog"
import { useGame } from "../store/gameStore"
import { countryFillGeometry, EARTH_R } from "./geo"

const texCache = new Map<string, CanvasTexture>()
const geoCache = new Map<string, BufferGeometry>()
const waiters = new Map<string, Array<(tex: CanvasTexture | null) => void>>()
const queue: string[] = []
let pumping = false

function raster(iso: string) {
  return new Promise<CanvasTexture | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement("canvas")
      c.width = 128
      c.height = 64
      const ctx = c.getContext("2d", { alpha: false, willReadFrequently: false })
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, 128, 64)
      const tex = new CanvasTexture(c)
      tex.colorSpace = SRGBColorSpace
      tex.generateMipmaps = false
      tex.minFilter = LinearFilter
      tex.magFilter = LinearFilter
      tex.flipY = true
      tex.needsUpdate = true
      resolve(tex)
    }
    img.onerror = () => resolve(null)
    img.src = `${import.meta.env.BASE_URL}flags/${iso.toLowerCase()}.svg`
  })
}

function pump() {
  if (pumping) return
  pumping = true
  const step = () => {
    const iso = queue.shift()
    if (!iso) {
      pumping = false
      return
    }
    void raster(iso).then((tex) => {
      if (tex) texCache.set(iso, tex)
      const cbs = waiters.get(iso) ?? []
      waiters.delete(iso)
      cbs.forEach((cb) => cb(tex))
      requestAnimationFrame(step)
    })
  }
  requestAnimationFrame(step)
}

function loadFlag(iso: string) {
  const ready = texCache.get(iso)
  if (ready) return Promise.resolve(ready)
  return new Promise<CanvasTexture | null>((resolve) => {
    const list = waiters.get(iso)
    if (list) {
      list.push(resolve)
      return
    }
    waiters.set(iso, [resolve])
    queue.push(iso)
    pump()
  })
}

function geometryFor(iso: string, feature: GeoJSON.Feature) {
  const cached = geoCache.get(iso)
  if (cached) return cached
  const next = countryFillGeometry(feature, EARTH_R + 0.008)
  if (next) {
    next.computeBoundingSphere()
    geoCache.set(iso, next)
    return next
  }
  return null
}

function FlagCountry({
  feature,
  iso,
  selected,
  highlighted,
  opened,
}: {
  feature: GeoJSON.Feature
  iso: string
  selected: boolean
  highlighted: boolean
  opened: boolean
}) {
  const geo = useMemo(() => geometryFor(iso, feature), [iso, feature])
  const [map, setMap] = useState<CanvasTexture | null>(() => texCache.get(iso) ?? null)

  useEffect(() => {
    if (map) return
    let live = true
    void loadFlag(iso).then((tex) => {
      if (live && tex) setMap(tex)
    })
    return () => {
      live = false
    }
  }, [iso, map])

  if (!geo || !map) return null
  const tint = selected || highlighted ? "#fff4c2" : opened ? "#ffffff" : "#dbe3ec"
  return (
    <mesh geometry={geo} raycast={() => undefined} frustumCulled={false}>
      <meshBasicMaterial
        map={map}
        color={tint}
        side={DoubleSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-4}
        depthWrite
      />
    </mesh>
  )
}

export function CountryFlags() {
  const selectedIso = useGame((s) => s.selectedIso)
  const highlightIso = useGame((s) => s.highlightIso)
  const visited = useGame((s) => s.progress.visited)
  const introPhase = useGame((s) => s.introPhase)
  const opened = useMemo(() => new Set(visited), [visited])
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([])

  useEffect(() => {
    void loadCatalog().then((pack) => setFeatures(pack.features))
  }, [])

  const items = useMemo(() => {
    if (introPhase !== "ready") return []
    const out: { iso: string; feature: GeoJSON.Feature }[] = []
    const seen = new Set<string>()
    for (const feature of features) {
      const iso = isoOf(feature)
      if (!iso || iso.length !== 2 || iso === "-99" || seen.has(iso)) continue
      seen.add(iso)
      out.push({ iso, feature })
    }
    return out
  }, [features, introPhase])

  return (
    <group>
      {items.map(({ iso, feature }) => (
        <FlagCountry
          key={iso}
          iso={iso}
          feature={feature}
          selected={selectedIso === iso}
          highlighted={highlightIso === iso}
          opened={opened.has(iso)}
        />
      ))}
    </group>
  )
}
