import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, DoubleSide, Quaternion, SRGBColorSpace, Vector3 } from "three"
import { getCatalog } from "../geo/catalog"
import { EARTH_R, latLngToVec } from "./geo"

const Y_UP = new Vector3(0, 1, 0)

function Pole({ iso }: { iso: string }) {
  const [map, setMap] = useState<CanvasTexture | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement("canvas")
      c.width = 160
      c.height = 96
      c.getContext("2d")?.drawImage(img, 0, 0, 160, 96)
      const tex = new CanvasTexture(c)
      tex.colorSpace = SRGBColorSpace
      setMap(tex)
    }
    img.src = `${import.meta.env.BASE_URL}flags/${iso.toLowerCase()}.svg`
  }, [iso])
  const rec = getCatalog()?.byIso.get(iso)
  const posed = useMemo(() => {
    const pos = latLngToVec(rec?.lat ?? 0, rec?.lng ?? 0, EARTH_R)
    const quat = new Quaternion().setFromUnitVectors(Y_UP, pos.clone().normalize())
    return { pos, quat }
  }, [rec?.lat, rec?.lng])

  return (
    <group position={posed.pos} quaternion={posed.quat} raycast={() => undefined}>
      <mesh position={[0, 0.26, 0]} castShadow={false} raycast={() => undefined}>
        <cylinderGeometry args={[0.014, 0.02, 0.52, 8]} />
        <meshStandardMaterial color="#d8c48a" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 0]} raycast={() => undefined}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshStandardMaterial color="#8a6a32" roughness={0.7} />
      </mesh>
      {map ? (
        <mesh position={[0.16, 0.4, 0]} raycast={() => undefined}>
          <planeGeometry args={[0.32, 0.2]} />
          <meshBasicMaterial map={map} side={DoubleSide} transparent />
        </mesh>
      ) : null}
    </group>
  )
}

export function FlagPins({ isos }: { isos: string[] }) {
  if (!isos.length) return null
  return (
    <group>
      {isos.map((iso) => (
        <Pole key={iso} iso={iso} />
      ))}
    </group>
  )
}
