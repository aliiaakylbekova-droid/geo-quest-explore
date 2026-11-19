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
import { countryFillGeometry, EARTH_R, isPolarFeature } from "./geo"

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
  fresh,
}: {
  feature: GeoJSON.Feature
  iso: string
  selected: boolean
  highlighted: boolean
  fresh: boolean
}) {
  const geo = useMemo(() => geoCache.get(iso) ?? geometryFor(iso, feature), [iso, feature])
  const [map, setMap] = useState<CanvasTexture | null>(() => texCache.get(iso) ?? null)
  const [opacity, setOpacity] = useState(fresh ? 0 : 1)

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

  useEffect(() => {
    if (!fresh) {
      setOpacity(1)
      return
    }
    setOpacity(0)
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 680)
      const ease = 1 - (1 - k) ** 3
      setOpacity(ease)
      if (k < 1) raf = window.requestAnimationFrame(step)
    }
    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [fresh, iso])

  if (!geo || !map) return null
  const tint = selected || highlighted ? "#fff4c2" : "#ffffff"
  return (
    <mesh geometry={geo} raycast={() => undefined}>
      <meshBasicMaterial
        map={map}
        color={tint}
        side={DoubleSide}
        toneMapped={false}
        transparent={opacity < 0.999}
        opacity={opacity}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-4}
        depthWrite={opacity >= 0.999}
      />
    </mesh>
  )
}

export function CountryFlags() {
  const stage = useGame((s) => s.stage)
  const selectedIso = useGame((s) => s.selectedIso)
  const highlightIso = useGame((s) => s.highlightIso)
  const unlocked = useGame((s) => s.progress.flagUnlocked)
  const flagFillIso = useGame((s) => s.flagFillIso)
  const [byIso, setByIso] = useState<Map<string, GeoJSON.Feature>>(() => new Map())

  useEffect(() => {
    void loadCatalog().then((pack) => {
      const next = new Map<string, GeoJSON.Feature>()
      for (const feature of pack.features) {
        const iso = isoOf(feature)
        if (!iso || iso.length !== 2 || iso === "-99" || iso === "AQ") continue
        if (isPolarFeature(feature)) continue
        next.set(iso, feature)
      }
      setByIso(next)
    })
  }, [])

  const isos = useMemo(() => {
    const list = [...unlocked]
    if (flagFillIso && !list.includes(flagFillIso)) list.push(flagFillIso)
    return list
  }, [unlocked, flagFillIso])

  if (stage !== "flag") return null

  return (
    <group>
      {isos.map((iso) => {
        const feature = byIso.get(iso)
        if (!feature) return null
        return (
          <FlagCountry
            key={iso}
            iso={iso}
            feature={feature}
            selected={selectedIso === iso}
            highlighted={highlightIso === iso}
            fresh={flagFillIso === iso}
          />
        )
      })}
    </group>
  )
}
