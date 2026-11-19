import { Canvas } from "@react-three/fiber"
import { type ReactNode, useEffect } from "react"
import { WebGLRenderer } from "three"

function bindGlLog(gl: WebGLRenderer) {
  const el = gl.domElement
  const lost = (event: Event) => {
    event.preventDefault()
    console.error("[geo-quest] WebGL context lost", event)
  }
  const restored = () => console.warn("[geo-quest] WebGL context restored")
  el.addEventListener("webglcontextlost", lost)
  el.addEventListener("webglcontextrestored", restored)
}

function bindTouchLock(el: HTMLCanvasElement) {
  el.style.touchAction = "none"
  const wrap = el.parentElement
  if (wrap instanceof HTMLElement) {
    wrap.style.touchAction = "none"
    wrap.style.overscrollBehavior = "none"
  }
  const stop = (event: TouchEvent) => {
    event.preventDefault()
  }
  el.addEventListener("touchstart", stop, { passive: false })
  el.addEventListener("touchmove", stop, { passive: false })
  wrap?.addEventListener("touchmove", stop, { passive: false })
}

function useGameScrollLock() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add("gq-lock")
    body.classList.add("gq-lock")
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    const block = (event: TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(".gq-tutorial-card, .intro-card, .hud-nav-sheet, .hud-bottom, .hud-top, input, select, textarea")) return
      if (target.closest("canvas, .world-canvas, .hud-center")) event.preventDefault()
    }
    document.addEventListener("touchmove", block, { passive: false })
    return () => {
      html.classList.remove("gq-lock")
      body.classList.remove("gq-lock")
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
      document.removeEventListener("touchmove", block)
    }
  }, [])
}

export function WorldCanvas({
  children,
  cameraZ = 11.2,
}: {
  children: ReactNode
  cameraZ?: number
}) {
  const land = cameraZ > 14
  useGameScrollLock()
  return (
    <Canvas
      className="world-canvas"
      style={{ touchAction: "none", cursor: "grab" }}
      camera={{
        position: land ? [11, 7.5, cameraZ] : [0, 0.55, cameraZ],
        fov: 40,
        near: 0.1,
        far: 160,
      }}
      dpr={[1, 1.25]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
      }}
      shadows={false}
      frameloop="always"
      onCreated={({ gl }) => {
        gl.setClearColor("#050814")
        bindGlLog(gl)
        bindTouchLock(gl.domElement)
        console.info("[geo-quest] WebGL", gl.getContext().getParameter(gl.getContext().VERSION))
      }}
      onPointerMissed={() => undefined}
    >
      {children}
    </Canvas>
  )
}
