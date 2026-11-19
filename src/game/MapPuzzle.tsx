import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { CONTINENT_RU, LEARNING_CONTINENTS, type LearningContinent } from "../data/continents"
import {
  GOLD_SELECT,
  OCEAN_DEEP,
  OCEAN_SHELF,
  PUZZLE_BOUNDS,
  PUZZLE_SIZE,
  clientToMap,
  nextPuzzleLevel,
  pieceHit,
  piecesFromFeatures,
  puzzleIsos,
  puzzleKey,
  puzzleTimeMs,
  puzzleXp,
  type PuzzleDiff,
  type PuzzlePiece,
} from "../data/puzzle"
import { getCatalog, loadCatalog } from "../geo/catalog"
import { audio } from "../audio/AudioManager"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"
import { formatClock } from "./logic"

type DragLive = {
  iso: string
  pointerId: number
  mx: number
  my: number
  sx: number
  sy: number
  over: boolean
}

type AnimKind = "lock" | "back" | "done"

type AnimLive = {
  iso: string
  kind: AnimKind
  x0: number
  y0: number
  x1: number
  y1: number
  t0: number
  ms: number
}

export type MapPuzzleProps = {
  lockedContinent?: LearningContinent
  lockedDiff?: PuzzleDiff
  hideChrome?: boolean
  skipXp?: boolean
  onComplete?: (xp: number, leftoverMs: number) => void
}

function shuffle<T>(list: T[]) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function easeOut(k: number) {
  return 1 - Math.pow(1 - k, 3)
}

function nameSize(p: PuzzlePiece) {
  const bw = Math.max(14, p.x1 - p.x0)
  const bh = Math.max(10, p.y1 - p.y0)
  const byBox = Math.min((bw / Math.max(3, p.name.length)) * 1.65, bh * 0.46)
  return Math.max(8.5, Math.min(15.5, byBox))
}

function PuzzleName({ piece, dim }: { piece: PuzzlePiece; dim?: boolean }) {
  const fs = nameSize(piece)
  return (
    <text
      x={piece.cx}
      y={piece.cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fs}
      fontWeight={700}
      fill={dim ? "rgba(244,247,251,0.9)" : "#f7f4ea"}
      stroke="#101810"
      strokeWidth={Math.max(2.4, fs * 0.2)}
      paintOrder="stroke"
      style={{ pointerEvents: "none", fontFamily: 'Inter, "Segoe UI", sans-serif' }}
    >
      {piece.name}
    </text>
  )
}

export function MapPuzzle({
  lockedContinent,
  lockedDiff,
  hideChrome,
  skipXp,
  onComplete,
}: MapPuzzleProps = {}) {
  const progress = useGame((s) => s.progress)
  const completePuzzle = useGame((s) => s.completePuzzle)
  const home = (LEARNING_CONTINENTS as readonly string[]).includes(progress.learningContinent)
    ? (progress.learningContinent as LearningContinent)
    : "Asia"
  const [continent, setContinent] = useState<LearningContinent>(lockedContinent ?? home)
  const [diff, setDiff] = useState<PuzzleDiff>(lockedDiff ?? "easy")
  const [pieces, setPieces] = useState<PuzzlePiece[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [placed, setPlaced] = useState<string[]>([])
  const [flashIso, setFlashIso] = useState<string | null>(null)
  const [completePulse, setCompletePulse] = useState(false)
  const [dragView, setDragView] = useState<DragLive | null>(null)
  const [animView, setAnimView] = useState<AnimLive | null>(null)
  const [endsAt, setEndsAt] = useState(() => Date.now() + puzzleTimeMs(lockedDiff ?? "easy"))
  const [won, setWon] = useState(false)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(Date.now())
  const svgRef = useRef<SVGSVGElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const trayRefs = useRef(new Map<string, HTMLButtonElement>())
  const dragRef = useRef<DragLive | null>(null)
  const animRef = useRef<AnimLive | null>(null)
  const rafRef = useRef(0)
  const awarded = useRef(false)
  const ui = t().play
  const box = PUZZLE_BOUNDS[continent]
  const catalog = getCatalog()

  useEffect(() => {
    if (lockedContinent) setContinent(lockedContinent)
  }, [lockedContinent])

  useEffect(() => {
    if (lockedDiff) setDiff(lockedDiff)
  }, [lockedDiff])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let dead = false
    void loadCatalog().then((cat) => {
      if (dead) return
      const isos = puzzleIsos(continent, diff, cat.countries)
      const built = piecesFromFeatures(cat.features, isos, cat.countries, box)
      setPieces(built)
      setOrder(shuffle(built.map((p) => p.iso)))
      setPlaced([])
      dragRef.current = null
      setDragView(null)
      setWon(false)
      setFailed(false)
      setCompletePulse(false)
      awarded.current = false
      setEndsAt(Date.now() + puzzleTimeMs(diff))
    })
    return () => {
      dead = true
    }
  }, [continent, diff, box])

  const left = Math.max(0, endsAt - now)
  const byIso = useMemo(() => new Map(pieces.map((p) => [p.iso, p])), [pieces])
  const ghosts = useMemo(() => {
    const cat = catalog
    if (!cat) return []
    const isos = cat.countries.filter((c) => c.continent === continent && c.iso.length === 2).map((c) => c.iso)
    return piecesFromFeatures(cat.features, isos, cat.countries, box)
  }, [catalog, continent, box])

  useEffect(() => {
    if (won || failed || !pieces.length) return
    if (left > 0) return
    setFailed(true)
  }, [left, won, failed, pieces.length])

  useEffect(() => {
    if (!pieces.length || placed.length < pieces.length || won) return
    setCompletePulse(true)
    const id = window.setTimeout(() => {
      setWon(true)
      if (awarded.current) return
      awarded.current = true
      const leftover = Math.max(0, endsAt - Date.now())
      const xp = puzzleXp(diff, leftover)
      if (!skipXp) completePuzzle(puzzleKey(continent, diff), xp)
      else completePuzzle(puzzleKey(continent, diff), xp, { skipXp: true })
      onComplete?.(xp, leftover)
    }, 720)
    return () => window.clearTimeout(id)
  }, [placed, pieces.length, won, continent, diff, completePuzzle, skipXp, onComplete, endsAt])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function mapPoint(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0, scaleX: 1, scaleY: 1 }
    return clientToMap(svg.getBoundingClientRect(), clientX, clientY)
  }

  function paintDrag(next: DragLive | null) {
    dragRef.current = next
    setDragView(next)
  }

  function runAnim(anim: AnimLive, onDone: () => void) {
    animRef.current = anim
    setAnimView(anim)
    const tick = (now: number) => {
      const live = animRef.current
      if (!live) return
      const k = Math.min(1, (now - live.t0) / live.ms)
      setAnimView({ ...live })
      if (k < 1) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      animRef.current = null
      setAnimView(null)
      onDone()
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function onDown(iso: string, e: ReactPointerEvent<HTMLButtonElement>) {
    if (won || failed || placed.includes(iso) || dragRef.current || animRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const root = rootRef.current
    try {
      root?.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort; window listeners still run */
    }
    const p = mapPoint(e.clientX, e.clientY)
    const piece = byIso.get(iso)
    paintDrag({
      iso,
      pointerId: e.pointerId,
      mx: p.x,
      my: p.y,
      sx: e.clientX,
      sy: e.clientY,
      over: piece ? pieceHit(piece, p.x, p.y) : false,
    })
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || animRef.current) return
    e.preventDefault()
    const p = mapPoint(e.clientX, e.clientY)
    const piece = byIso.get(drag.iso)
    paintDrag({
      ...drag,
      mx: p.x,
      my: p.y,
      sx: e.clientX,
      sy: e.clientY,
      over: piece ? pieceHit(piece, p.x, p.y) : false,
    })
  }

  function releaseCapture(pointerId: number) {
    const root = rootRef.current
    if (root?.hasPointerCapture?.(pointerId)) {
      try {
        root.releasePointerCapture(pointerId)
      } catch {
        /* already released */
      }
    }
  }

  function finishDrag(pointerId: number) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== pointerId || animRef.current) return
    const piece = byIso.get(drag.iso)
    releaseCapture(pointerId)
    if (piece && pieceHit(piece, drag.mx, drag.my)) {
      audio.play("discovery")
      setFlashIso(piece.iso)
      runAnim(
        { iso: piece.iso, kind: "lock", x0: drag.mx, y0: drag.my, x1: piece.cx, y1: piece.cy, t0: performance.now(), ms: 280 },
        () => {
          setPlaced((prev) => (prev.includes(piece.iso) ? prev : [...prev, piece.iso]))
          paintDrag(null)
          window.setTimeout(() => setFlashIso((cur) => (cur === piece.iso ? null : cur)), 420)
        },
      )
      paintDrag(null)
      return
    }
    audio.play("fail")
    const trayBtn = trayRefs.current.get(drag.iso)
    const svg = svgRef.current
    let x1 = drag.mx
    let y1 = drag.my + 80
    if (trayBtn && svg) {
      const r = trayBtn.getBoundingClientRect()
      const back = clientToMap(svg.getBoundingClientRect(), r.left + r.width / 2, r.top + r.height / 2)
      x1 = back.x
      y1 = back.y
    }
    const iso = drag.iso
    const fromX = drag.mx
    const fromY = drag.my
    paintDrag(null)
    runAnim({ iso, kind: "back", x0: fromX, y0: fromY, x1, y1, t0: performance.now(), ms: 320 }, () => {
      /* snap-back done; piece stays in tray */
    })
  }

  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    finishDrag(e.pointerId)
  }

  function replay() {
    setOrder(shuffle(pieces.map((p) => p.iso)))
    setPlaced([])
    paintDrag(null)
    animRef.current = null
    setAnimView(null)
    setWon(false)
    setFailed(false)
    setCompletePulse(false)
    awarded.current = false
    setEndsAt(Date.now() + puzzleTimeMs(diff))
  }

  function next() {
    const n = nextPuzzleLevel(continent, diff)
    setContinent(n.continent)
    setDiff(n.diff)
  }

  const tray = order.filter((iso) => !placed.includes(iso))
  const clock = formatClock(left)
  const live = dragView
  const anim = animView
  const flyingIso = live?.iso ?? anim?.iso
  const svg = svgRef.current
  const mapRect = svg?.getBoundingClientRect()
  let flyX = live?.mx ?? 0
  let flyY = live?.my ?? 0
  if (anim) {
    const k = easeOut(Math.min(1, (performance.now() - anim.t0) / anim.ms))
    flyX = anim.x0 + (anim.x1 - anim.x0) * k
    flyY = anim.y0 + (anim.y1 - anim.y0) * k
  }
  const flyPiece = flyingIso ? byIso.get(flyingIso) : null

  return (
    <div
      ref={rootRef}
      className={`gq-puzzle${completePulse ? " is-complete" : ""}`}
      data-puzzle={`${continent}-${diff}`}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={(e) => finishDrag(e.pointerId)}
    >
      {hideChrome ? null : (
        <div className="gq-puzzle-bar">
          <label>
            {ui.puzzleContinent}
            <select
              value={continent}
              disabled={Boolean(lockedContinent)}
              onChange={(e) => setContinent(e.target.value as LearningContinent)}
            >
              {LEARNING_CONTINENTS.map((c) => (
                <option key={c} value={c}>
                  {CONTINENT_RU[c]}
                </option>
              ))}
            </select>
          </label>
          <div className="gq-puzzle-diffs">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={diff === d ? "chip on" : "chip"}
                disabled={Boolean(lockedDiff)}
                onClick={() => setDiff(d)}
              >
                {t().settings[d]}
              </button>
            ))}
          </div>
          <b className={left < 15000 ? "is-warn" : ""}>{clock}</b>
          <span>
            {placed.length}/{pieces.length || "—"}
          </span>
        </div>
      )}
      {hideChrome ? (
        <div className="gq-puzzle-bar is-mini">
          <b className={left < 15000 ? "is-warn" : ""}>{clock}</b>
          <span>
            {placed.length}/{pieces.length || "—"}
          </span>
        </div>
      ) : null}
      <svg
        ref={svgRef}
        className="gq-puzzle-map is-terrain"
        viewBox={`0 0 ${PUZZLE_SIZE.w} ${PUZZLE_SIZE.h}`}
        role="img"
        aria-label={ui.puzzle}
      >
        <defs>
          <linearGradient id="ocean-terrain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OCEAN_SHELF} />
            <stop offset="100%" stopColor={OCEAN_DEEP} />
          </linearGradient>
          <filter id="terrain-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.4" stdDeviation="1.2" floodColor="#0a141c" floodOpacity="0.45" />
          </filter>
          <filter id="gold-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor={GOLD_SELECT} floodOpacity="0.85" />
          </filter>
        </defs>
        <rect x="0" y="0" width={PUZZLE_SIZE.w} height={PUZZLE_SIZE.h} fill="url(#ocean-terrain)" />
        {ghosts.map((g) => (
          <path key={`g-${g.iso}`} d={g.d} fill="#2a3c32" stroke="#3d5246" strokeWidth="0.7" />
        ))}
        {pieces.map((p) =>
          placed.includes(p.iso) ? (
            <g key={`ok-${p.iso}`}>
              <path
                d={p.d}
                fill={p.color}
                stroke={flashIso === p.iso ? GOLD_SELECT : "#3d4a40"}
                strokeWidth={flashIso === p.iso ? 2.2 : 1.05}
                filter={flashIso === p.iso ? "url(#gold-glow)" : "url(#terrain-shadow)"}
              />
              <PuzzleName piece={p} />
            </g>
          ) : (
            <g key={`slot-${p.iso}`}>
              <path
                d={p.d}
                fill={live?.iso === p.iso && live.over ? "rgba(232,197,71,0.28)" : "#3c4a36"}
                stroke={live?.iso === p.iso && live.over ? GOLD_SELECT : "#c4b48a"}
                strokeWidth={live?.iso === p.iso && live.over ? 1.8 : 1.1}
                strokeDasharray={live?.iso === p.iso && live.over ? undefined : "4 3"}
              />
              <PuzzleName piece={p} dim />
            </g>
          ),
        )}
      </svg>
      {flyPiece && mapRect ? (
        <div className="gq-drag-layer" aria-hidden>
          <svg
            className="gq-drag-svg"
            viewBox={`0 0 ${PUZZLE_SIZE.w} ${PUZZLE_SIZE.h}`}
            width={mapRect.width}
            height={mapRect.height}
            style={{ left: mapRect.left, top: mapRect.top }}
          >
            <path
              d={flyPiece.d}
              transform={`translate(${flyX - flyPiece.cx} ${flyY - flyPiece.cy})`}
              fill={flyPiece.color}
              stroke={GOLD_SELECT}
              strokeWidth="2.1"
              filter="url(#gold-glow)"
              opacity={anim?.kind === "back" ? 0.88 : 1}
            />
          </svg>
        </div>
      ) : null}
      <div className="gq-puzzle-tray" aria-label={ui.puzzleTray}>
        {tray.map((iso) => {
          const p = byIso.get(iso)
          if (!p) return null
          const lifting = flyingIso === iso
          return (
            <button
              key={iso}
              type="button"
              ref={(el) => {
                if (el) trayRefs.current.set(iso, el)
                else trayRefs.current.delete(iso)
              }}
              className={`gq-piece is-terrain${lifting ? " is-lifting" : ""}`}
              style={{ ["--piece" as string]: p.color }}
              onPointerDown={(e) => onDown(iso, e)}
            >
              <svg viewBox={`${p.cx - 70} ${p.cy - 50} 140 100`}>
                <path d={p.d} fill={p.color} stroke="#2c382e" strokeWidth="1.2" />
              </svg>
              <span>{p.name}</span>
            </button>
          )
        })}
      </div>
      {won || failed ? (
        hideChrome && won ? null : (
          <div className="gq-puzzle-done">
            <strong>{won ? ui.puzzleWin : ui.timesUp}</strong>
            <p>{won ? ui.puzzleWinBody : ui.puzzleFail}</p>
            <div className="gq-exit-actions">
              <button type="button" className="intro-start intro-journey" onClick={replay}>
                {ui.puzzleReplay}
              </button>
              {won && !hideChrome ? (
                <button type="button" className="btn" onClick={next}>
                  {ui.puzzleNext}
                </button>
              ) : null}
            </div>
          </div>
        )
      ) : null}
    </div>
  )
}
