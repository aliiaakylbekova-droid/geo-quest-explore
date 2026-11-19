import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { CONTINENT_RU, LEARNING_CONTINENTS, type LearningContinent } from "../data/continents"
import {
  PUZZLE_BOUNDS,
  PUZZLE_SIZE,
  nextPuzzleLevel,
  piecesFromFeatures,
  puzzleIsos,
  puzzleKey,
  puzzleTimeMs,
  puzzleXp,
  type PuzzleDiff,
  type PuzzlePiece,
} from "../data/puzzle"
import { getCatalog, loadCatalog } from "../geo/catalog"
import { t } from "../i18n"
import { useGame } from "../store/gameStore"
import { formatClock } from "./logic"

const SNAP = 42

function shuffle<T>(list: T[]) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function clientToSvg(svg: SVGSVGElement, x: number, y: number) {
  const pt = svg.createSVGPoint()
  pt.x = x
  pt.y = y
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

export function MapPuzzle() {
  const progress = useGame((s) => s.progress)
  const completePuzzle = useGame((s) => s.completePuzzle)
  const home = (LEARNING_CONTINENTS as readonly string[]).includes(progress.learningContinent)
    ? (progress.learningContinent as LearningContinent)
    : "Asia"
  const [continent, setContinent] = useState<LearningContinent>(home)
  const [diff, setDiff] = useState<PuzzleDiff>("easy")
  const [pieces, setPieces] = useState<PuzzlePiece[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [placed, setPlaced] = useState<string[]>([])
  const [drag, setDrag] = useState<{ iso: string; x: number; y: number } | null>(null)
  const [endsAt, setEndsAt] = useState(() => Date.now() + puzzleTimeMs("easy"))
  const [won, setWon] = useState(false)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(Date.now())
  const svgRef = useRef<SVGSVGElement>(null)
  const awarded = useRef(false)
  const ui = t().play
  const box = PUZZLE_BOUNDS[continent]
  const catalog = getCatalog()

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
      setDrag(null)
      setWon(false)
      setFailed(false)
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
    setWon(true)
    if (awarded.current) return
    awarded.current = true
    completePuzzle(puzzleKey(continent, diff), puzzleXp(diff, left))
  }, [placed, pieces.length, won, continent, diff, left, completePuzzle])

  function onDown(iso: string, e: ReactPointerEvent<HTMLButtonElement>) {
    if (won || failed || placed.includes(iso)) return
    const svg = svgRef.current
    if (!svg) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const p = clientToSvg(svg, e.clientX, e.clientY)
    setDrag({ iso, x: p.x, y: p.y })
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    const svg = svgRef.current
    if (!svg) return
    const p = clientToSvg(svg, e.clientX, e.clientY)
    setDrag({ ...drag, x: p.x, y: p.y })
  }

  function onUp() {
    if (!drag) return
    const piece = byIso.get(drag.iso)
    if (piece) {
      const dx = drag.x - piece.cx
      const dy = drag.y - piece.cy
      if (dx * dx + dy * dy <= SNAP * SNAP) {
        setPlaced((prev) => (prev.includes(drag.iso) ? prev : [...prev, drag.iso]))
        setDrag(null)
        return
      }
    }
    setDrag(null)
  }

  function replay() {
    setOrder(shuffle(pieces.map((p) => p.iso)))
    setPlaced([])
    setDrag(null)
    setWon(false)
    setFailed(false)
    awarded.current = false
    setEndsAt(Date.now() + puzzleTimeMs(diff))
  }

  function next() {
    const n = nextPuzzleLevel(continent, diff)
    setContinent(n.continent)
    setDiff(n.diff)
  }

  const tray = order.filter((iso) => !placed.includes(iso) && drag?.iso !== iso)
  const clock = formatClock(left)

  return (
    <div className="gq-puzzle" data-puzzle={`${continent}-${diff}`} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="gq-puzzle-bar">
        <label>
          {ui.puzzleContinent}
          <select value={continent} onChange={(e) => setContinent(e.target.value as LearningContinent)}>
            {LEARNING_CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {CONTINENT_RU[c]}
              </option>
            ))}
          </select>
        </label>
        <div className="gq-puzzle-diffs">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <button key={d} type="button" className={diff === d ? "chip on" : "chip"} onClick={() => setDiff(d)}>
              {t().settings[d]}
            </button>
          ))}
        </div>
        <b className={left < 15000 ? "is-warn" : ""}>{clock}</b>
        <span>
          {placed.length}/{pieces.length || "—"}
        </span>
      </div>
      <svg
        ref={svgRef}
        className="gq-puzzle-map"
        viewBox={`0 0 ${PUZZLE_SIZE.w} ${PUZZLE_SIZE.h}`}
        role="img"
        aria-label={ui.puzzle}
      >
        <rect x="0" y="0" width={PUZZLE_SIZE.w} height={PUZZLE_SIZE.h} fill="rgba(8,18,28,0.55)" />
        {ghosts.map((g) => (
          <path key={`g-${g.iso}`} d={g.d} fill="rgba(180,210,220,0.08)" stroke="rgba(244,247,251,0.28)" strokeWidth="1.1" />
        ))}
        {pieces.map((p) =>
          placed.includes(p.iso) ? (
            <path key={`ok-${p.iso}`} d={p.d} fill="rgba(94,231,255,0.42)" stroke="#5ee7ff" strokeWidth="1.6" />
          ) : (
            <path key={`slot-${p.iso}`} d={p.d} fill="rgba(232,197,71,0.05)" stroke="rgba(232,197,71,0.35)" strokeWidth="1.2" strokeDasharray="5 4" />
          ),
        )}
        {drag
          ? (() => {
              const p = byIso.get(drag.iso)
              if (!p) return null
              const dx = drag.x - p.cx
              const dy = drag.y - p.cy
              return <path d={p.d} transform={`translate(${dx} ${dy})`} fill="rgba(94,231,255,0.55)" stroke="#fff" strokeWidth="1.8" />
            })()
          : null}
      </svg>
      <div className="gq-puzzle-tray" aria-label={ui.puzzleTray}>
        {tray.map((iso) => {
          const p = byIso.get(iso)
          if (!p) return null
          return (
            <button
              key={iso}
              type="button"
              className="gq-piece"
              onPointerDown={(e) => onDown(iso, e)}
            >
              <svg viewBox={`${p.cx - 70} ${p.cy - 50} 140 100`}>
                <path d={p.d} fill="#5ee7ff" stroke="#071018" strokeWidth="1.4" />
              </svg>
              <span>{p.name}</span>
            </button>
          )
        })}
      </div>
      {won || failed ? (
        <div className="gq-puzzle-done">
          <strong>{won ? ui.puzzleWin : ui.timesUp}</strong>
          <p>{won ? ui.puzzleWinBody : ui.puzzleFail}</p>
          <div className="gq-exit-actions">
            <button type="button" className="intro-start intro-journey" onClick={replay}>
              {ui.puzzleReplay}
            </button>
            {won ? (
              <button type="button" className="btn" onClick={next}>
                {ui.puzzleNext}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
