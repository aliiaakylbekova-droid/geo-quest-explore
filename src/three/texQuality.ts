import { LinearFilter, LinearMipmapLinearFilter, type Texture, type WebGLRenderer } from "three"

let maxAniso = 8

export function setRendererQuality(gl: WebGLRenderer) {
  maxAniso = Math.max(8, gl.capabilities.getMaxAnisotropy())
}

export function applyTexQuality(tex: Texture, aniso = maxAniso) {
  tex.generateMipmaps = true
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.anisotropy = Math.max(1, aniso)
  tex.needsUpdate = true
}

export function labelDpr() {
  if (typeof window === "undefined") return 2
  return Math.min(3, Math.max(2, window.devicePixelRatio || 1))
}
