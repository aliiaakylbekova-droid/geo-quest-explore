import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3 } from "three"

export const EARTH_R = 2

export function latLngToVec(lat: number, lng: number, radius = EARTH_R) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

export function vecToLatLng(v: Vector3) {
  const n = v.clone().normalize()
  const lat = 90 - (Math.acos(Math.min(1, Math.max(-1, n.y))) * 180) / Math.PI
  // Inverse of latLngToVec (theta = lng+180). Missing the −180 made
  // Europe/America sit on the wrong hemisphere under the cursor.
  let lng = (Math.atan2(n.z, -n.x) * 180) / Math.PI - 180
  if (lng <= -180) lng += 360
  if (lng > 180) lng -= 360
  return { lat, lng }
}

export function cameraFor(lat: number, lng: number, dist: number) {
  return latLngToVec(lat, lng, dist)
}

function pushLine(positions: number[], coords: number[][], radius: number) {
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = latLngToVec(coords[i][1], coords[i][0], radius)
    const b = latLngToVec(coords[i + 1][1], coords[i + 1][0], radius)
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
}

export function geometryFromGeoJSON(features: GeoJSON.Feature[], radius = EARTH_R + 0.008) {
  const positions: number[] = []
  for (const feature of features) {
    const g = feature.geometry
    if (!g) continue
    if (g.type === "LineString") pushLine(positions, g.coordinates as number[][], radius)
    else if (g.type === "MultiLineString") {
      for (const line of g.coordinates as number[][][]) pushLine(positions, line, radius)
    } else if (g.type === "Polygon") {
      for (const ring of g.coordinates) pushLine(positions, ring as number[][], radius)
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        for (const ring of poly) pushLine(positions, ring as number[][], radius)
      }
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3))
  return geo
}

function dropClosing(ring: number[][]): number[][] {
  if (ring.length < 2) return ring
  const a = ring[0]
  const b = ring[ring.length - 1]
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1)
  return ring
}

function unwrapRing(ring: number[][]): [number, number][] {
  const pts = dropClosing(ring)
  if (!pts.length) return []
  let prev = pts[0][0]
  const out: [number, number][] = []
  for (const p of pts) {
    let lng = p[0]
    while (lng - prev > 180) lng -= 360
    while (prev - lng > 180) lng += 360
    prev = lng
    out.push([lng, p[1]])
  }
  return out
}

function polygonsOf(geom: GeoJSON.Geometry): number[][][][] {
  if (geom.type === "Polygon") return [geom.coordinates as number[][][]]
  if (geom.type === "MultiPolygon") return geom.coordinates as number[][][][]
  return []
}

/** Triangulated country mesh on the sphere. UVs map the unwrapped bbox so a flag texture clips to the border. */
export function countryFillGeometry(feature: GeoJSON.Feature, radius = EARTH_R + 0.0036): BufferGeometry | null {
  const geom = feature.geometry
  if (!geom) return null
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (const polygon of polygonsOf(geom)) {
    if (!polygon[0] || polygon[0].length < 3) continue
    const rings = polygon.map(unwrapRing).filter((ring) => ring.length >= 3)
    if (!rings.length) continue

    let minLng = Infinity
    let maxLng = -Infinity
    let minLat = Infinity
    let maxLat = -Infinity
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
    const spanLng = Math.max(1e-6, maxLng - minLng)
    const spanLat = Math.max(1e-6, maxLat - minLat)

    const contour = rings[0].map(([lng, lat]) => new Vector2(lng, lat))
    const holes = rings.slice(1).map((ring) => ring.map(([lng, lat]) => new Vector2(lng, lat)))
    let faces: number[][] = []
    try {
      faces = ShapeUtils.triangulateShape(contour, holes)
    } catch {
      faces = []
    }
    if (!faces.length) {
      contour.reverse()
      try {
        faces = ShapeUtils.triangulateShape(contour, holes)
      } catch {
        continue
      }
    }
    if (!faces.length) continue

    const verts = [...contour, ...holes.flat()]
    const base = positions.length / 3
    for (const v of verts) {
      const p = latLngToVec(v.y, v.x, radius)
      positions.push(p.x, p.y, p.z)
      uvs.push((v.x - minLng) / spanLng, (v.y - minLat) / spanLat)
    }
    for (const face of faces) {
      if (face.length < 3) continue
      indices.push(base + face[0], base + face[1], base + face[2])
    }
  }

  if (indices.length < 3 || positions.length < 9) return null
  const geo = new BufferGeometry()
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  return geo
}

export function countryBboxSpan(feature: GeoJSON.Feature) {
  const geom = feature.geometry
  if (!geom) return 0
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const polygon of polygonsOf(geom)) {
    const ring = unwrapRing(polygon[0] || [])
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  if (!Number.isFinite(minLng)) return 0
  return (maxLng - minLng) * (maxLat - minLat)
}
