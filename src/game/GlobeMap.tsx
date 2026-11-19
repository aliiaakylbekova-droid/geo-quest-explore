import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import countryNames from "../data/country-names.json"
import { loadCatalog, loadHiResCountries } from "../geo/catalog"
import { CountryLabels, HoverCapital, type LabelCountry } from "../three/CountryLabels"
import { EarthScene, EarthWarmup } from "../three/EarthScene"
import type { GlobeHover } from "../three/GlobePick"
import { CameraRig } from "../three/CameraRig"
import { ErrorBoundary } from "../three/ErrorBoundary"
import { WorldCanvas } from "../three/WorldCanvas"
import { useGame } from "../store/gameStore"
import { useFrame, useThree } from "@react-three/fiber"

const BUNDLED_NAMES = countryNames as LabelCountry[]

function LodTracker({ onLod }: { onLod: (lod: number) => void }) {
  const { camera } = useThree()
  const last = useRef(-1)
  useFrame(() => {
    const d = camera.position.length()
    const lod = d > 7.2 ? 0 : d > 4.4 ? 1 : 2
    if (lod !== last.current) {
      last.current = lod
      onLod(lod)
    }
  })
  return null
}

export function EarthBundle({
  onPick,
  onHover,
}: {
  onPick: (hit: { iso: string | null; lat: number; lng: number }) => void
  onHover?: (hit: GlobeHover | null) => void
}) {
  const layers = useGame((s) => s.layers)
  const selectedIso = useGame((s) => s.selectedIso)
  const highlightIso = useGame((s) => s.highlightIso)
  const flyTo = useGame((s) => s.flyTo)
  const stage = useGame((s) => s.stage)
  const campaign = useGame((s) => s.campaign)
  const [lod, setLod] = useState(0)
  const [pack, setPack] = useState<Awaited<ReturnType<typeof loadCatalog>> | null>(null)
  const [hoverIso, setHoverIso] = useState<string | null>(null)
  const countries = pack?.countries ?? BUNDLED_NAMES
  const showNames = stage === "flag" || (stage !== "mission" && stage !== "discover" && !campaign)
  const hoverCapitals = stage === "flag"
  const labeled = useMemo(() => {
    if (lod === 0) return countries.filter((c) => (c.pop ?? 0) > 12_000_000)
    if (lod === 1) return countries.filter((c) => (c.pop ?? 0) > 8_000_000)
    return countries
  }, [countries, lod])

  useEffect(() => {
    void loadCatalog().then((c) => setPack(c))
  }, [])

  useEffect(() => {
    if (lod < 2) return
    const id = window.setTimeout(() => {
      void loadHiResCountries().then((c) => setPack({ ...c }))
    }, 1600)
    return () => window.clearTimeout(id)
  }, [lod])

  const features = useMemo(() => {
    if (!pack) return []
    return lod >= 2 && pack.features50 ? pack.features50 : pack.features
  }, [pack, lod])

  return (
    <>
      <LodTracker onLod={setLod} />
      <CountryLabels countries={labeled} visible={showNames} keepIso={selectedIso || highlightIso || hoverIso} />
      {hoverCapitals ? <HoverCapital iso={hoverIso} enabled /> : null}
      <Suspense fallback={<EarthWarmup />}>
        <EarthScene
          features={features}
          cities={pack?.cities ?? []}
          rivers={pack?.rivers ?? []}
          lakes={pack?.lakes ?? []}
          marine={pack?.marine ?? []}
          mountains={pack?.mountains ?? []}
          selectedIso={selectedIso}
          highlightIso={highlightIso}
          layers={layers}
          flyTo={flyTo}
          lod={lod}
          onPick={onPick}
          onFly={(hit) => {
            if (hit.iso) useGame.getState().fly(hit.lat, hit.lng, 2.58)
          }}
          onHover={(hit) => {
            setHoverIso(hit?.iso ?? null)
            onHover?.(hit)
          }}
        />
      </Suspense>
    </>
  )
}

export function GlobeMap({ onPick }: { onPick: (hit: { iso: string | null; lat: number; lng: number }) => void }) {
  return (
    <ErrorBoundary>
      <WorldCanvas cameraZ={11.2}>
        <CameraRig mode="earth" />
        <EarthBundle onPick={onPick} />
      </WorldCanvas>
    </ErrorBoundary>
  )
}
