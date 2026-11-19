import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import { CanvasTexture, Sprite, SRGBColorSpace, Vector3, type Group, type Texture } from "three"
import { capitalForIso } from "../geo/catalog"
import { applyTexQuality, labelDpr } from "./texQuality"
import { EARTH_R, latLngToVec } from "./geo"

export type LabelCountry = {
  iso: string
  name: string
  lat: number
  lng: number
  pop?: number | null
}

const cache = new Map<string, CanvasTexture>()

function paintLabel(text: string, fill: string, mark = false) {
  const dpr = labelDpr()
  const key = `${mark ? "cap" : "n"}:${dpr}:${fill}:${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const fontPx = mark ? 40 : 44
  const c = document.createElement("canvas")
  const ctx = c.getContext("2d")
  if (!ctx) {
    const empty = new CanvasTexture(c)
    cache.set(key, empty)
    return empty
  }
  ctx.font = `700 ${fontPx}px Inter, "Segoe UI", sans-serif`
  const tw = Math.max(28, ctx.measureText(text).width)
  const w = Math.ceil(tw + 32)
  const h = fontPx + (mark ? 36 : 26)
  c.width = Math.ceil(w * dpr)
  c.height = Math.ceil(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.font = `700 ${fontPx}px Inter, "Segoe UI", sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.lineJoin = "round"
  ctx.miterLimit = 2
  const cy = mark ? h / 2 + 6 : h / 2
  ctx.lineWidth = 7
  ctx.strokeStyle = "rgba(7,16,24,0.92)"
  ctx.strokeText(text, w / 2, cy)
  ctx.fillStyle = fill
  ctx.fillText(text, w / 2, cy)
  if (mark) {
    ctx.beginPath()
    ctx.fillStyle = "#e8c547"
    ctx.arc(w / 2, 10, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.userData = { aspect: w / h }
  applyTexQuality(tex)
  cache.set(key, tex)
  return tex
}

function labelTexture(text: string) {
  return paintLabel(text, "#f4f7fb", false)
}

function capitalTexture(text: string) {
  return paintLabel(text, "#ffe08a", true)
}

function spriteAspect(sp: Sprite) {
  const map = (sp.material as { map?: Texture | null }).map
  const aspect = Number(map?.userData?.aspect)
  return aspect > 0.4 ? aspect : 4
}

export function CountryLabels({
  countries,
  visible,
  keepIso,
}: {
  countries: LabelCountry[]
  visible: boolean
  keepIso?: string | null
}) {
  const { camera, size } = useThree()
  const group = useRef<Group>(null)
  const scratch = useRef(new Vector3())
  const items = useMemo(() => {
    return countries
      .filter((c) => c.iso.length === 2 && c.iso !== "AQ" && c.iso !== "-99")
      .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
      .map((c) => ({
        iso: c.iso,
        name: c.name,
        pop: c.pop ?? 0,
        pos: latLngToVec(c.lat, c.lng, EARTH_R + 0.08),
        tex: labelTexture(c.name),
      }))
  }, [countries])

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = visible
    if (!visible) return
    const cam = camera.position
    const dist = cam.length()
    const h = dist > 8.2 ? 0.155 : dist > 6.4 ? 0.132 : dist > 5.1 ? 0.112 : dist > 4.1 ? 0.098 : 0.086
    const minSep = dist > 7.2 ? 48 : dist > 5.4 ? 34 : dist > 4 ? 22 : 14
    const accepted: { x: number; y: number }[] = []
    for (const child of g.children) {
      const sp = child as Sprite
      const iso = sp.name
      const world = sp.getWorldPosition(scratch.current)
      const facing = world.dot(cam) > 0
      const keep = iso === keepIso
      if (!facing) {
        sp.visible = false
        continue
      }
      world.project(camera)
      const sx = (world.x * 0.5 + 0.5) * size.width
      const sy = (1 - (world.y * 0.5 + 0.5)) * size.height
      let overlap = false
      if (!keep) {
        for (const a of accepted) {
          const dx = a.x - sx
          const dy = a.y - sy
          if (dx * dx + dy * dy < minSep * minSep) {
            overlap = true
            break
          }
        }
      }
      sp.visible = keep || !overlap
      if (sp.visible) accepted.push({ x: sx, y: sy })
      const aspect = spriteAspect(sp)
      const hh = keep && dist < 4.1 ? Math.max(h, 0.11) : h
      sp.scale.set(hh * aspect, hh, 1)
    }
  })

  if (!visible) return null
  return (
    <group ref={group} raycast={() => undefined}>
      {items.map((it) => (
        <sprite key={it.iso} name={it.iso} position={it.pos} frustumCulled={false} raycast={() => undefined}>
          <spriteMaterial map={it.tex} transparent depthTest={false} sizeAttenuation />
        </sprite>
      ))}
    </group>
  )
}

export function HoverCapital({ iso, enabled }: { iso: string | null; enabled: boolean }) {
  const { camera } = useThree()
  const sprite = useRef<Sprite>(null)
  const scratch = useRef(new Vector3())
  const place = enabled ? capitalForIso(iso) : null

  useFrame(() => {
    const sp = sprite.current
    if (!sp || !place) return
    const cam = camera.position
    const dist = cam.length()
    const h = dist > 7 ? 0.14 : dist > 5.2 ? 0.12 : 0.1
    const world = sp.getWorldPosition(scratch.current)
    sp.visible = world.dot(cam) > 0
    const aspect = spriteAspect(sp)
    sp.scale.set(h * aspect, h, 1)
  })

  if (!enabled || !place) return null
  const pos = latLngToVec(place.lat, place.lng, EARTH_R + 0.1)
  return (
    <sprite ref={sprite} position={pos} frustumCulled={false} raycast={() => undefined}>
      <spriteMaterial map={capitalTexture(place.name)} transparent depthTest={false} sizeAttenuation />
    </sprite>
  )
}
