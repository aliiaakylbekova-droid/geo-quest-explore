import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import { CanvasTexture, Sprite, SRGBColorSpace, Vector3, type Group } from "three"
import type { CountryRecord } from "../geo/catalog"
import { EARTH_R, latLngToVec } from "./geo"

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
}: {
  countries: CountryRecord[]
  visible: boolean
}) {
  const { camera } = useThree()
  const group = useRef<Group>(null)
  const items = useMemo(() => {
    return countries
      .filter((c) => c.iso.length === 2 && (c.pop ?? 0) > 12_000_000)
      .map((c) => ({
        iso: c.iso,
        name: c.name,
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
    for (const child of g.children) {
      const sp = child as Sprite
      const world = sp.getWorldPosition(new Vector3())
      const facing = world.dot(cam) > 2.2
      const dist = cam.length()
      sp.visible = facing && dist < 8.2
      const s = dist > 5.5 ? 0.42 : 0.32
      sp.scale.set(s * 2.4, s * 0.6, 1)
    }
  })

  if (!visible) return null
  return (
    <group ref={group} raycast={() => undefined}>
      {items.map((it) => (
        <sprite key={it.iso} position={it.pos} raycast={() => undefined}>
          <spriteMaterial map={it.tex} transparent depthTest={false} sizeAttenuation />
        </sprite>
      ))}
    </group>
  )
}
