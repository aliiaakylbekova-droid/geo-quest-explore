import { useEffect, useState } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"
import { getCatalog } from "../geo/catalog"
import { EARTH_R, latLngToVec } from "./geo"

function Pin({ iso }: { iso: string }) {
  const [map, setMap] = useState<CanvasTexture | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement("canvas")
      c.width = 128
      c.height = 80
      c.getContext("2d")?.drawImage(img, 0, 0, 128, 80)
      const tex = new CanvasTexture(c)
      tex.colorSpace = SRGBColorSpace
      setMap(tex)
    }
    img.src = `${import.meta.env.BASE_URL}flags/${iso.toLowerCase()}.svg`
  }, [iso])
  const rec = getCatalog()?.byIso.get(iso)
  const pos = latLngToVec(rec?.lat ?? 0, rec?.lng ?? 0, EARTH_R + 0.12)
  if (!map) return null
  return (
    <sprite position={pos} scale={[0.32, 0.2, 1]} raycast={() => undefined}>
      <spriteMaterial map={map} transparent depthTest={false} />
    </sprite>
  )
}

export function FlagPins({ isos }: { isos: string[] }) {
  if (!isos.length) return null
  return (
    <group>
      {isos.map((iso) => (
        <Pin key={iso} iso={iso} />
      ))}
    </group>
  )
}
