import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace, Vector3, type Group } from "three"
import { capitalForIso } from "../geo/catalog"
import { EARTH_R, latLngToVec } from "./geo"

export type LabelCountry = {
  iso: string
  name: string
  lat: number
  lng: number
  pop?: number | null
}

const cache = new Map<string, { tex: CanvasTexture; aspect: number }>()

function shortName(name: string) {
  const t = name.trim()
  if (t.length <= 18) return t
  return `${t.slice(0, 16)}…`
}

function roundChip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function labelTexture(text: string, hot: boolean) {
  const label = shortName(text)
  const key = `${hot ? "hot" : "idle"}:${label}`
  const hit = cache.get(key)
  if (hit) return hit
  const dpr = typeof window === "undefined" ? 2 : Math.min(2, Math.max(1.5, window.devicePixelRatio || 1))
  const fontSize = 13
  const measure = document.createElement("canvas").getContext("2d")
  if (measure) measure.font = `700 ${fontSize}px Inter, "Segoe UI", sans-serif`
  const tw = Math.min(148, Math.ceil(measure?.measureText(label).width ?? label.length * 7.2))
  const padX = 6
  const padY = 2.5
  const w = tw + padX * 2
  const h = fontSize + padY * 2
  const c = document.createElement("canvas")
  c.width = Math.ceil(w * dpr)
  c.height = Math.ceil(h * dpr)
  const ctx = c.getContext("2d")
  if (ctx) {
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    roundChip(ctx, 0.5, 0.5, w - 1, h - 1, h / 2)
    ctx.fillStyle = hot ? "rgba(8, 16, 26, 0.9)" : "rgba(8, 14, 22, 0.72)"
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = hot ? "rgba(255, 224, 138, 0.95)" : "rgba(244, 247, 251, 0.42)"
    ctx.stroke()
    ctx.font = `700 ${fontSize}px Inter, "Segoe UI", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineJoin = "round"
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)"
    ctx.shadowBlur = 2
    ctx.lineWidth = 2.2
    ctx.strokeStyle = "rgba(6, 12, 20, 0.95)"
    ctx.strokeText(label, w / 2, h / 2 + 0.2)
    ctx.shadowBlur = 0
    ctx.fillStyle = hot ? "#ffe08a" : "#f7fbff"
    ctx.fillText(label, w / 2, h / 2 + 0.2)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  const packed = { tex, aspect: w / h }
  cache.set(key, packed)
  return packed
}

function minPopForDist(dist: number) {
  if (dist > 8.6) return 40_000_000
  if (dist > 7.2) return 22_000_000
  if (dist > 5.8) return 12_000_000
  if (dist > 4.6) return 6_000_000
  if (dist > 3.7) return 2_200_000
  return 500_000
}

function maxLabelsForDist(dist: number) {
  if (dist > 8) return 8
  if (dist > 6.2) return 12
  if (dist > 4.8) return 16
  if (dist > 3.8) return 20
  return 24
}

export function CountryLabels({
  countries,
  visible,
  keepIso,
  hoverIso,
}: {
  countries: LabelCountry[]
  visible: boolean
  keepIso?: string | null
  hoverIso?: string | null
}) {
  const { camera, size } = useThree()
  const group = useRef<Group>(null)
  const scratch = useRef(new Vector3())
  const items = useMemo(() => {
    return countries
      .filter((c) => c.iso.length === 2 && c.iso !== "AQ")
      .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
      .map((c) => {
        const idle = labelTexture(c.name, false)
        const hot = labelTexture(c.name, true)
        return {
          iso: c.iso,
          pop: c.pop ?? 0,
          pos: latLngToVec(c.lat, c.lng, EARTH_R + 0.05),
          idle,
          hot,
        }
      })
  }, [countries])

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = visible
    if (!visible) return
    const cam = camera.position
    const dist = cam.length()
    const popCut = minPopForDist(dist)
    const cap = maxLabelsForDist(dist)
    const baseH = dist > 8.2 ? 0.072 : dist > 6.4 ? 0.062 : dist > 5.1 ? 0.054 : dist > 4.1 ? 0.046 : 0.04
    const fov = ((camera as { fov?: number }).fov ?? 50) * (Math.PI / 180)
    const padL = size.width < 900 ? 8 : 300
    const padR = size.width < 900 ? 8 : 320
    const padT = size.width < 900 ? 122 : 108
    const padB = size.width < 900 ? 96 : 118
    const boxes: { l: number; r: number; t: number; b: number }[] = []
    let shown = 0
    const ordered = [...g.children].sort((a, b) => {
      const ah = a.name === keepIso || a.name === hoverIso ? 0 : 1
      const bh = b.name === keepIso || b.name === hoverIso ? 0 : 1
      if (ah !== bh) return ah - bh
      return Number((b as Sprite).userData.pop ?? 0) - Number((a as Sprite).userData.pop ?? 0)
    })
    for (const child of ordered) {
      const sp = child as Sprite
      const iso = sp.name
      const pop = Number(sp.userData.pop ?? 0)
      const world = sp.getWorldPosition(scratch.current)
      const facing = world.dot(cam) > 0
      const keep = iso === keepIso
      const hover = iso === hoverIso
      const hot = keep || hover
      if (!facing) {
        sp.visible = false
        continue
      }
      if (!hot && pop < popCut) {
        sp.visible = false
        continue
      }
      const toSprite = Math.max(0.8, cam.distanceTo(world))
      world.project(camera)
      if (world.z > 1) {
        sp.visible = false
        continue
      }
      const sx = (world.x * 0.5 + 0.5) * size.width
      const sy = (1 - (world.y * 0.5 + 0.5)) * size.height
      if (!hot && (sx < padL || sx > size.width - padR || sy < padT || sy > size.height - padB)) {
        sp.visible = false
        continue
      }
      const h = hot ? Math.max(baseH, 0.058) : baseH
      const pack = hot ? (sp.userData.hot as { tex: CanvasTexture; aspect: number }) : (sp.userData.idle as { tex: CanvasTexture; aspect: number })
      const aspect = pack?.aspect ?? Number(sp.userData.aspect ?? 3)
      const spriteWorldPerPx = (2 * toSprite * Math.tan(fov / 2)) / Math.max(1, size.height)
      const pixH = h / spriteWorldPerPx
      const pixW = pixH * aspect
      const box = { l: sx - pixW / 2, r: sx + pixW / 2, t: sy - pixH / 2, b: sy + pixH / 2 }
      let overlap = false
      if (!hot) {
        for (const a of boxes) {
          if (box.l < a.r + 6 && box.r > a.l - 6 && box.t < a.b + 4 && box.b > a.t - 4) {
            overlap = true
            break
          }
        }
      }
      if (!hot && (overlap || shown >= cap)) {
        sp.visible = false
        continue
      }
      sp.visible = true
      shown += 1
      boxes.push(box)
      const mat = sp.material as SpriteMaterial
      if (pack && mat.map !== pack.tex) {
        mat.map = pack.tex
        sp.userData.aspect = pack.aspect
      }
      sp.scale.set(h * aspect, h, 1)
    }
  })

  if (!visible) return null
  return (
    <group ref={group} raycast={() => undefined}>
      {items.map((it) => (
        <sprite
          key={it.iso}
          name={it.iso}
          position={it.pos}
          userData={{ pop: it.pop, aspect: it.idle.aspect, idle: it.idle, hot: it.hot }}
          raycast={() => undefined}
        >
          <spriteMaterial map={it.idle.tex} transparent depthTest={false} depthWrite={false} sizeAttenuation />
        </sprite>
      ))}
    </group>
  )
}

function capitalTexture(text: string) {
  const label = shortName(text)
  const key = `capchip:${label}`
  const hit = cache.get(key)
  if (hit) return hit.tex
  const packed = labelTexture(label, true)
  cache.set(key, packed)
  return packed.tex
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
    const s = dist > 7 ? 0.07 : dist > 5.2 ? 0.06 : 0.05
    const world = sp.getWorldPosition(scratch.current)
    sp.visible = world.dot(cam) > 0
    const aspect = Math.min(6.2, Math.max(2.6, shortName(place.name).length * 0.33))
    sp.scale.set(s * aspect, s, 1)
  })

  if (!enabled || !place) return null
  const pos = latLngToVec(place.lat, place.lng, EARTH_R + 0.07)
  return (
    <sprite ref={sprite} position={pos} raycast={() => undefined}>
      <spriteMaterial map={capitalTexture(place.name)} transparent depthTest={false} depthWrite={false} sizeAttenuation />
    </sprite>
  )
}
