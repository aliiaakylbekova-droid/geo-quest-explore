import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import { CanvasTexture, Sprite, SRGBColorSpace, Vector3, type Group } from "three"
import { capitalForIso } from "../geo/catalog"
import { EARTH_R, latLngToVec } from "./geo"

export type LabelCountry = {
  iso: string
  name: string
  lat: number
  lng: number
  pop?: number | null
}

const cache = new Map<string, CanvasTexture>()

function labelTexture(text: string) {
  const hit = cache.get(text)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 64
  const ctx = c.getContext("2d")
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.font = "700 22px Inter, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineWidth = 4
    ctx.strokeStyle = "rgba(7,16,24,0.85)"
    ctx.strokeText(text, 128, 32)
    ctx.fillStyle = "#f4f7fb"
    ctx.fillText(text, 128, 32)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  cache.set(text, tex)
  return tex
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
      .filter((c) => c.iso.length === 2 && (c.pop ?? 0) > 4_000_000)
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
    const s = dist > 8.2 ? 0.56 : dist > 6.4 ? 0.42 : dist > 5.1 ? 0.3 : dist > 4.1 ? 0.2 : 0.12
    const minSep = dist > 7 ? 54 : dist > 5.4 ? 42 : 32
    const hideExtras = dist < 3.32
    const accepted: { x: number; y: number }[] = []
    for (const child of g.children) {
      const sp = child as Sprite
      const iso = sp.name
      const world = sp.getWorldPosition(scratch.current)
      const facing = world.dot(cam) > 0
      if (!facing || dist < 3.05) {
        sp.visible = false
        continue
      }
      if (hideExtras && iso !== keepIso) {
        sp.visible = false
        continue
      }
      world.project(camera)
      const sx = (world.x * 0.5 + 0.5) * size.width
      const sy = (1 - (world.y * 0.5 + 0.5)) * size.height
      let overlap = false
      for (const a of accepted) {
        const dx = a.x - sx
        const dy = a.y - sy
        if (dx * dx + dy * dy < minSep * minSep) {
          overlap = true
          break
        }
      }
      const keep = iso === keepIso
      sp.visible = keep || !overlap
      if (sp.visible) accepted.push({ x: sx, y: sy })
      sp.scale.set(s * 2.2, s * 0.52, 1)
    }
  })

  if (!visible) return null
  return (
    <group ref={group} raycast={() => undefined}>
      {items.map((it) => (
        <sprite key={it.iso} name={it.iso} position={it.pos} raycast={() => undefined}>
          <spriteMaterial map={it.tex} transparent depthTest={false} sizeAttenuation />
        </sprite>
      ))}
    </group>
  )
}

function capitalTexture(text: string) {
  const key = `cap:${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 64
  const ctx = c.getContext("2d")
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.font = "650 20px Inter, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineWidth = 4
    ctx.strokeStyle = "rgba(7,16,24,0.88)"
    ctx.strokeText(text, 128, 34)
    ctx.fillStyle = "#ffe08a"
    ctx.fillText(text, 128, 34)
    ctx.beginPath()
    ctx.fillStyle = "#e8c547"
    ctx.arc(128, 10, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  cache.set(key, tex)
  return tex
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
    const s = dist > 7 ? 0.48 : dist > 5.2 ? 0.38 : 0.3
    const world = sp.getWorldPosition(scratch.current)
    sp.visible = world.dot(cam) > 0
    sp.scale.set(s * 2.2, s * 0.58, 1)
  })

  if (!enabled || !place) return null
  const pos = latLngToVec(place.lat, place.lng, EARTH_R + 0.1)
  return (
    <sprite ref={sprite} position={pos} raycast={() => undefined}>
      <spriteMaterial map={capitalTexture(place.name)} transparent depthTest={false} sizeAttenuation />
    </sprite>
  )
}
