import { useId } from "react"

type MarkSize = "sm" | "md" | "lg" | "xl"

const SIZES: Record<MarkSize, number> = { sm: 22, md: 32, lg: 56, xl: 88 }

export function CompassGlobeMark({ size = "md", className = "" }: { size?: MarkSize; className?: string }) {
  const uid = useId().replace(/:/g, "")
  const fill = `gq-globe-fill-${uid}`
  const gold = `gq-ring-gold-${uid}`
  const px = SIZES[size]
  return (
    <svg
      className={`gq-mark ${className}`.trim()}
      width={px}
      height={px}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={fill} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#2e6a78" />
          <stop offset="55%" stopColor="#16384a" />
          <stop offset="100%" stopColor="#0b1c28" />
        </radialGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3e0a0" />
          <stop offset="50%" stopColor="#e8c547" />
          <stop offset="100%" stopColor="#b8892a" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="34" r="21.2" fill={`url(#${fill})`} stroke={`url(#${gold})`} strokeWidth="1.6" />
      <ellipse cx="32" cy="34" rx="8.4" ry="20.4" fill="none" stroke="#8fd4e2" strokeWidth="0.7" opacity="0.55" />
      <ellipse cx="32" cy="34" rx="15.6" ry="20.4" fill="none" stroke="#8fd4e2" strokeWidth="0.65" opacity="0.4" />
      <path d="M12.2 34h39.6M32 14.2v39.6" fill="none" stroke="#c9eef4" strokeWidth="0.7" opacity="0.55" />
      <path d="M14.8 24.2h34.4M14.8 43.8h34.4" fill="none" stroke="#7eb8c6" strokeWidth="0.55" opacity="0.45" />
      <path
        d="M32 3.2 L36.6 14.6 L48.4 18.8 L36.6 23.2 L32 34.4 L27.4 23.2 L15.6 18.8 L27.4 14.6 Z"
        fill={`url(#${gold})`}
        stroke="#7a5a18"
        strokeWidth="0.55"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="18.8" r="1.35" fill="#1a1204" />
    </svg>
  )
}

export function CompassGlobeWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`gq-wordmark${compact ? " is-compact" : ""}`}>
      <CompassGlobeMark size={compact ? "sm" : "md"} />
      <strong>GEO QUEST</strong>
    </span>
  )
}
