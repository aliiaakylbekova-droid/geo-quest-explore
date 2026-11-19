import { OrbitControls, Stars } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react"
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  SRGBColorSpace,
  Spherical,
  TextureLoader,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type Mesh,
  type MeshStandardMaterial,
  type Sprite,
  type Texture,
} from "three"
import { useGame } from "../store/gameStore"
import type { NamedLine } from "../geo/catalog"
import { isoOf, type Place } from "../geo/catalog"
import { EARTH_R, cameraFor, geometryFromGeoJSON, latLngToVec } from "./geo"
import { CountryFlags } from "./CountryFlags"
import { GlobePick, type GlobeHover } from "./GlobePick"
import { applyTexQuality } from "./texQuality"

export type Layers = {
  relief: boolean
  rivers: boolean
  borders: boolean
  capitals: boolean
  climate: boolean
}

export function EarthWarmup() {
  return (
    <mesh>
      <sphereGeometry args={[EARTH_R, 48, 32]} />
      <meshStandardMaterial color="#3d6ea8" roughness={0.82} metalness={0.04} />
    </mesh>
  )
}

const jpegCache = new Map<string, Texture>()

function prefetchJpeg(path: string, srgb: boolean) {
  if (typeof window === "undefined" || jpegCache.has(path)) return
  new TextureLoader().load(path, (ready) => {
    if (srgb) ready.colorSpace = SRGBColorSpace
    applyTexQuality(ready)
    jpegCache.set(path, ready)
  })
}

prefetchJpeg(`${import.meta.env.BASE_URL}textures/earth-day.jpg`, true)
prefetchJpeg(`${import.meta.env.BASE_URL}textures/earth-bump.jpg`, false)
prefetchJpeg(`${import.meta.env.BASE_URL}textures/earth-water.png`, false)

function useJpegTexture(path: string, srgb: boolean) {
  const [tex, setTex] = useState<Texture | null>(() => jpegCache.get(path) ?? null)
  useEffect(() => {
    const hit = jpegCache.get(path)
    if (hit) {
      setTex(hit)
      return
    }
    let dead = false
    new TextureLoader().load(
      path,
      (ready) => {
        if (srgb) ready.colorSpace = SRGBColorSpace
        applyTexQuality(ready)
        jpegCache.set(path, ready)
        if (!dead) setTex(ready)
      },
      undefined,
      () => {
        if (!dead) setTex(null)
      },
    )
    return () => {
      dead = true
    }
  }, [path, srgb])
  return tex
}

type Props = {
  features: GeoJSON.Feature[]
  cities: Place[]
  rivers: NamedLine[]
  lakes: NamedLine[]
  marine: NamedLine[]
  mountains: NamedLine[]
  selectedIso: string | null
  highlightIso: string | null
  layers: Layers
  flyTo: { lat: number; lng: number; dist: number } | null
  lod: number
  onPick: (hit: { iso: string | null; lat: number; lng: number }) => void
  onHover?: (hit: GlobeHover | null) => void
  onFly?: (hit: { iso: string | null; lat: number; lng: number }) => void
}

function ClimateShell({ on }: { on: boolean }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 1024
    c.height = 512
    const ctx = c.getContext("2d")
    if (!ctx) return null
    const bands = [
      [0, "#d8ecff"],
      [0.12, "#7eb3e8"],
      [0.28, "#8fce7a"],
      [0.42, "#e3c96a"],
      [0.5, "#d9894a"],
      [0.58, "#e3c96a"],
      [0.72, "#8fce7a"],
      [0.88, "#7eb3e8"],
      [1, "#d8ecff"],
    ]
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    for (const [s, col] of bands) g.addColorStop(s as number, col as string)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 512)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    applyTexQuality(t)
    return t
  }, [])
  if (!on || !tex) return null
  return (
    <mesh raycast={() => undefined}>
      <sphereGeometry args={[EARTH_R + 0.012, 64, 48]} />
      <meshBasicMaterial map={tex} transparent opacity={0.28} depthWrite={false} />
    </mesh>
  )
}

function PulseBeacon({ lat, lng }: { lat: number; lng: number }) {
  const sprite = useRef<Sprite>(null)
  const pos = useMemo(() => latLngToVec(lat, lng, EARTH_R + 0.14), [lat, lng])
  const tex = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 256
    c.height = 256
    const ctx = c.getContext("2d")
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 128)
      g.addColorStop(0, "rgba(255, 248, 200, 0.95)")
      g.addColorStop(0.28, "rgba(255, 210, 80, 0.75)")
      g.addColorStop(0.62, "rgba(232, 197, 71, 0.35)")
      g.addColorStop(1, "rgba(232, 197, 71, 0)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 256, 256)
    }
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useFrame(() => {
    const k = 0.5 + 0.5 * Math.sin(performance.now() * 0.008)
    if (sprite.current) {
      const s = 1.35 + 0.55 * k
      sprite.current.scale.set(s, s, 1)
    }
  })
  return (
    <sprite ref={sprite} position={pos} raycast={() => undefined}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} blending={AdditiveBlending} />
    </sprite>
  )
}

function Atmosphere({ close }: { close: boolean }) {
  return (
    <mesh scale={close ? 1.018 : 1.045} raycast={() => undefined}>
      <sphereGeometry args={[EARTH_R, 64, 48]} />
      <meshBasicMaterial
        color={close ? "#c9e8ff" : "#7ec8ff"}
        transparent
        opacity={close ? 0.07 : 0.14}
        blending={AdditiveBlending}
        side={BackSide}
      />
    </mesh>
  )
}

export function EarthScene({
  features,
  cities: _cities,
  rivers,
  lakes,
  marine: _marine,
  mountains: _mountains,
  selectedIso,
  highlightIso,
  layers,
  flyTo,
  lod: _lod,
  onPick,
  onHover,
  onFly,
}: Props) {
  const day = useJpegTexture(`${import.meta.env.BASE_URL}textures/earth-day.jpg`, true)
  const bump = useJpegTexture(`${import.meta.env.BASE_URL}textures/earth-bump.jpg`, false)
  const water = useJpegTexture(`${import.meta.env.BASE_URL}textures/earth-water.png`, false)
  const { camera } = useThree()
  const introPhase = useGame((s) => s.introPhase)
  const finishIntro = useGame((s) => s.finishIntro)
  const hitTint = useGame((s) => s.hitTint)
  const campaignPhase = useGame((s) => s.campaignPhase)
  const stage = useGame((s) => s.stage)
  const campaign = useGame((s) => s.campaign)
  const flagHunt = stage === "flag"
  const missionMode = (stage === "mission" || Boolean(campaign)) && !flagHunt
  const pulseIsos = useGame((s) => s.pulseIsos)
  const pulseCenter = useGame((s) => s.pulseCenter)
  void flagHunt
  const earth = useRef<Group>(null)
  const globeMesh = useRef<Mesh>(null)
  const landMat = useRef<MeshStandardMaterial>(null)
  const waterMat = useRef<MeshStandardMaterial>(null)
  const borderFar = useRef<LineBasicMaterial>(null)
  const borderNear = useRef<LineBasicMaterial>(null)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const fly = useRef(0)
  const target = useRef(new Vector3(0, 0.4, 6.2))
  const look = useRef(new Vector3(0, 0, 0))
  const far = useRef(cameraFor(18, 8, 11.2))
  const introClock = useRef(0)
  const introDone = useRef(false)
  const outline = useRef(new Color("#5ee7ff"))
  const outlineMat = useRef<LineBasicMaterial>(null)
  const pulseMat = useRef<LineBasicMaterial>(null)
  const closeRef = useRef(false)
  const [close, setClose] = useState(false)
  const sunDir = useMemo(() => new Vector3(7.4, 3.1, 5.2).normalize(), [])

  useEffect(() => {
    if (introPhase === "approach") {
      introClock.current = 0
      introDone.current = false
    }
  }, [introPhase])

  useEffect(() => {
    if (!flyTo || introPhase !== "ready") return
    target.current.copy(cameraFor(flyTo.lat, flyTo.lng, flyTo.dist))
    fly.current = 1
    const oc = controls.current
    if (oc) oc.enabled = false
  }, [flyTo, introPhase])

  useFrame((_, dt) => {
    const dist = camera.position.length()
    const isClose = dist < 3.55
    if (isClose !== closeRef.current) {
      closeRef.current = isClose
      setClose(isClose)
    }
    const bumpAmt = !layers.relief || !bump ? 0 : dist < 3.1 ? 0.16 : dist < 4.2 ? 0.1 : dist < 6 ? 0.06 : 0.04
    if (landMat.current) {
      landMat.current.bumpScale = bumpAmt
      landMat.current.roughness = dist < 3.4 ? 0.58 : 0.7
    }
    if (waterMat.current) {
      waterMat.current.opacity = dist < 3.4 ? 0.34 : 0.22
    }
    if (borderFar.current) borderFar.current.opacity = dist < 4 ? 1 : 0.78
    if (borderNear.current) {
      borderNear.current.opacity = dist < 3.6 ? 1 : dist < 5 ? 0.88 : 0.7
      borderNear.current.color.set(dist < 3.8 ? "#1a1610" : missionMode ? "#1a1408" : "#3a3428")
    }

    const want =
      hitTint === "gold" ? "#e8c547" : hitTint === "red" ? "#ff6a3d" : hitTint === "orange" ? "#ff9a4a" : "#5ee7ff"
    outline.current.lerp(new Color(want), 1 - Math.exp(-dt * 8))
    if (outlineMat.current) outlineMat.current.color.copy(outline.current)
    if (pulseMat.current) {
      pulseMat.current.opacity = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(performance.now() * 0.007))
    }

    if (introPhase !== "ready") {
      introClock.current += dt
      const sph = new Spherical().setFromVector3(camera.position)
      const goal = flyTo ? cameraFor(flyTo.lat, flyTo.lng, Math.max(5.05, flyTo.dist)) : far.current
      if (introPhase === "approach") {
        sph.theta += dt * 0.2
        sph.radius += (goal.length() - sph.radius) * (1 - Math.exp(-dt * 0.7))
        sph.phi += (new Spherical().setFromVector3(goal).phi - sph.phi) * (1 - Math.exp(-dt * 0.55))
        camera.position.setFromSpherical(sph)
        camera.lookAt(look.current)
        if (!introDone.current && (introClock.current > 3.05 || Math.abs(sph.radius - goal.length()) < 0.12)) {
          introDone.current = true
          finishIntro()
        }
      } else {
        sph.setFromVector3(far.current)
        sph.theta += introClock.current * 0.08
        camera.position.setFromSpherical(sph)
        camera.lookAt(look.current)
      }
      return
    }

    const oc = controls.current
    if (fly.current > 0) {
      if (oc) oc.enabled = false
      camera.position.lerp(target.current, 1 - Math.exp(-dt * 1.15))
      camera.lookAt(look.current)
      if (camera.position.distanceTo(target.current) < 0.035) {
        fly.current = 0
        if (oc) {
          oc.enabled = true
          oc.update()
        }
      }
    } else if (oc && !oc.enabled && campaignPhase !== "transition" && campaignPhase !== "correct" && campaignPhase !== "success") {
      oc.enabled = true
    }
  })

  const borderGeo = useMemo(() => geometryFromGeoJSON(features, EARTH_R + 0.0072), [features])
  const riverGeo = useMemo(() => {
    const fake: GeoJSON.Feature[] = rivers
      .filter((r) => r.coords && r.coords.length > 1)
      .map((r) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: r.coords! },
      }))
    return geometryFromGeoJSON(fake, EARTH_R + 0.01)
  }, [rivers])
  const lakeGeo = useMemo(() => {
    const fake: GeoJSON.Feature[] = lakes
      .filter((r) => r.coords && r.coords.length > 1)
      .map((r) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: r.coords! },
      }))
    return geometryFromGeoJSON(fake, EARTH_R + 0.009)
  }, [lakes])

  const [hoverIso, setHoverIso] = useState<string | null>(null)
  const outlineIso = hoverIso || highlightIso || selectedIso
  const selectedFeature = features.find((f) => isoOf(f) === outlineIso)
  const selectedGeo = useMemo(
    () => (selectedFeature ? geometryFromGeoJSON([selectedFeature], EARTH_R + 0.011) : null),
    [selectedFeature],
  )
  const pulseKey = pulseIsos.join(",")
  const pulseGeo = useMemo(() => {
    if (!pulseKey) return null
    const want = new Set(pulseKey.split(",").filter(Boolean))
    const feats = features.filter((f) => want.has(isoOf(f)))
    return feats.length ? geometryFromGeoJSON(feats, EARTH_R + 0.014) : null
  }, [features, pulseKey])

  const playing = introPhase === "ready" && campaignPhase !== "transition" && campaignPhase !== "correct" && campaignPhase !== "success"

  return (
    <group>
      <color attach="background" args={["#050814"]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={[new Color("#b7d7ff"), new Color("#1a120c"), 0.42]} />
      <directionalLight intensity={2.55} color="#fff4d0" position={sunDir.clone().multiplyScalar(12).toArray()} />
      <directionalLight intensity={0.38} color="#8eb4ff" position={[-6, 1.4, -5]} />
      <Stars radius={48} depth={24} count={700} factor={2.2} fade speed={0.25} />
      <GlobePick
        mesh={globeMesh}
        features={features}
        onPick={onPick}
        onHover={(hit) => {
          setHoverIso(hit?.iso ?? null)
          onHover?.(hit)
        }}
        onFly={onFly}
        enabled={playing}
      />
      <group ref={earth}>
      <mesh ref={globeMesh}>
        <sphereGeometry args={[EARTH_R, 96, 64]} />
        <meshStandardMaterial
          ref={landMat}
          map={day}
          bumpMap={layers.relief && bump ? bump : null}
          bumpScale={layers.relief && bump ? 0.055 : 0}
          roughness={0.68}
          metalness={0.03}
          color={day ? "#ffffff" : "#3d6ea8"}
        />
      </mesh>
      {water ? (
        <mesh raycast={() => undefined}>
          <sphereGeometry args={[EARTH_R + 0.0012, 96, 64]} />
          <meshStandardMaterial
            ref={waterMat}
            color="#3eb9c8"
            alphaMap={water}
            transparent
            opacity={0.24}
            depthWrite={false}
            roughness={0.18}
            metalness={0.22}
          />
        </mesh>
      ) : null}
      <Atmosphere close={close} />
      <ClimateShell on={layers.climate} />
      {layers.borders || missionMode || true ? (
        <>
          <lineSegments geometry={borderGeo} raycast={() => undefined}>
            <lineBasicMaterial ref={borderNear} color={missionMode ? "#1a1408" : "#241e16"} transparent opacity={0.92} />
          </lineSegments>
          <lineSegments geometry={borderGeo} raycast={() => undefined} scale={1.0036}>
            <lineBasicMaterial
              ref={borderFar}
              color={missionMode ? "#f6e6b8" : "#efe2c4"}
              transparent
              opacity={0.88}
            />
          </lineSegments>
        </>
      ) : null}
      {layers.rivers ? (
        <>
          <lineSegments geometry={riverGeo} raycast={() => undefined}>
            <lineBasicMaterial color="#7ad7ff" transparent opacity={0.88} />
          </lineSegments>
          <lineSegments geometry={lakeGeo} raycast={() => undefined}>
            <lineBasicMaterial color="#9ee7ff" transparent opacity={0.7} />
          </lineSegments>
        </>
      ) : null}
      {selectedGeo ? (
        <group>
          <lineSegments geometry={selectedGeo} raycast={() => undefined}>
            <lineBasicMaterial ref={outlineMat} color="#5ee7ff" transparent opacity={0.98} linewidth={2} />
          </lineSegments>
          <lineSegments geometry={selectedGeo} raycast={() => undefined} scale={1.006}>
            <lineBasicMaterial color="#fff8d0" transparent opacity={0.85} />
          </lineSegments>
        </group>
      ) : null}
      {pulseGeo ? (
        <group>
          <lineSegments geometry={pulseGeo} raycast={() => undefined} scale={1.006}>
            <lineBasicMaterial color="#7a5a10" transparent opacity={0.95} />
          </lineSegments>
          <lineSegments geometry={pulseGeo} raycast={() => undefined} scale={1.012}>
            <lineBasicMaterial ref={pulseMat} color="#ffe38a" transparent opacity={0.9} />
          </lineSegments>
        </group>
      ) : null}
      {pulseCenter ? <PulseBeacon lat={pulseCenter.lat} lng={pulseCenter.lng} /> : null}
      <CountryFlags />
      </group>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableRotate
        enableZoom
        autoRotate={false}
        enabled={playing}
        minDistance={2.28}
        maxDistance={12}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI - 0.12}
        zoomSpeed={0.72}
        rotateSpeed={0.48}
        enableDamping
        dampingFactor={0.22}
        touches={{ ONE: 0, TWO: 2 }}
      />
    </group>
  )
}
