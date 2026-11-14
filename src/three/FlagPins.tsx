import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, DoubleSide, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from "three"
import { getCatalog } from "../geo/catalog"
import { EARTH_R, latLngToVec } from "./geo"

const Y_UP = new Vector3(0, 1, 0)

function poseAt(lat: number, lng: number) {
  const pos = latLngToVec(lat, lng, EARTH_R)
  const n = pos.clone().normalize()
  const east = new Vector3().crossVectors(Y_UP, n)
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0)
  east.normalize()
  const north = new Vector3().crossVectors(n, east).normalize()
  const quat = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east, n, north))
  return { pos, quat }
}

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
  const posed = useMemo(() => poseAt(rec?.lat ?? 0, rec?.lng ?? 0), [rec?.lat, rec?.lng])

  return (
    <group position={posed.pos} quaternion={posed.quat} raycast={() => undefined}>
      <mesh position={[0, 0.14, 0]} raycast={() => undefined}>
        <cylinderGeometry args={[0.01, 0.013, 0.28, 8]} />
        <meshStandardMaterial color="#e6d4a0" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.012, 0]} raycast={() => undefined}>
        <sphereGeometry args={[0.02, 10, 8]} />
        <meshStandardMaterial color="#7a5728" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.282, 0]} raycast={() => undefined}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#f0d36a" metalness={0.5} roughness={0.3} />
      </mesh>
      {map ? (
        <mesh position={[0.08, 0.21, 0]} raycast={() => undefined}>
          <planeGeometry args={[0.16, 0.1]} />
          <meshBasicMaterial map={map} side={DoubleSide} transparent depthTest={false} />
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
