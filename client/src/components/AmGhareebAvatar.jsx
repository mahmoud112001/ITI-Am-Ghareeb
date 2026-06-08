/**
 * AmGhareebAvatar — inline SVG portrait of عم غريب.
 * An elderly Alexandrian man with a red tarboush, white beard, and warm smile.
 *
 * Props:
 *   size      {number}  — width & height in px (default 48)
 *   className {string}  — additional CSS classes (default '')
 */
export default function AmGhareebAvatar({ size = 48, className = '' }) {
  const showCollar = size > 60

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="عم غريب"
      role="img"
    >
      {/* ── Neck ──────────────────────────────────────────────────────────── */}
      <rect x="44" y="80" width="12" height="10" rx="2" fill="#C8845A" />

      {/* ── Galabiya collar (only at larger sizes) ───────────────────────── */}
      {showCollar && (
        <rect x="38" y="82" width="24" height="18" rx="2" fill="#FFFFFF" />
      )}

      {/* ── Face ──────────────────────────────────────────────────────────── */}
      <circle cx="50" cy="55" r="28" fill="#D4956A" />

      {/* ── Ears ──────────────────────────────────────────────────────────── */}
      <ellipse cx="22" cy="55" rx="4" ry="5" fill="#C8845A" />
      <ellipse cx="78" cy="55" rx="4" ry="5" fill="#C8845A" />

      {/* ── Tarboush (طربوش) ─────────────────────────────────────────────── */}
      {/* Main hat body */}
      <rect x="32" y="18" width="36" height="22" rx="4" fill="#C0392B" />
      {/* Hat brim */}
      <ellipse cx="50" cy="40" rx="20" ry="5" fill="#A93226" />
      {/* Top of hat slight curve */}
      <ellipse cx="50" cy="18" rx="18" ry="3" fill="#CD3D2F" />
      {/* Black tassel cord */}
      <path
        d="M 68 18 Q 74 22 72 32"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* Tassel end circle */}
      <circle cx="72" cy="33" r="2" fill="#1A1A1A" />

      {/* ── Eyebrows (wise, slightly arched) ─────────────────────────────── */}
      <path
        d="M 38 46 Q 43 43.5 48 46"
        stroke="#8D9091"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 52 46 Q 57 43.5 62 46"
        stroke="#8D9091"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Eyes (kind, slight squint) ───────────────────────────────────── */}
      <ellipse cx="43" cy="52" rx="3" ry="2.5" fill="#3D2B1F" />
      <ellipse cx="57" cy="52" rx="3" ry="2.5" fill="#3D2B1F" />
      {/* Eye shine */}
      <circle cx="44.2" cy="51" r="0.8" fill="#FFFFFF" opacity="0.7" />
      <circle cx="58.2" cy="51" r="0.8" fill="#FFFFFF" opacity="0.7" />
      {/* Squint lines above eyes */}
      <path d="M 40 50 Q 43 49 46 50" stroke="#B07A55" strokeWidth="1" fill="none" />
      <path d="M 54 50 Q 57 49 60 50" stroke="#B07A55" strokeWidth="1" fill="none" />

      {/* ── Nose ──────────────────────────────────────────────────────────── */}
      <path
        d="M 48 56 Q 46 61 48 63 Q 50 64.5 52 63 Q 54 61 52 56"
        stroke="#B07A55"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Warm smile ──────────────────────────────────────────────────────*/}
      <path
        d="M 42 64 Q 50 70 58 64"
        stroke="#8B5E3C"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── White-grey beard (covering jaw and chin) ──────────────────────── */}
      <path
        d="M 24 62 Q 24 78 50 82 Q 76 78 76 62 Q 70 68 60 70 Q 55 73 50 73 Q 45 73 40 70 Q 30 68 24 62 Z"
        fill="#D0D3D4"
        opacity="0.92"
      />
      {/* Beard texture lines */}
      <path d="M 35 65 Q 38 72 42 72" stroke="#B0B5B6" strokeWidth="0.8" fill="none" />
      <path d="M 50 67 Q 50 75 50 76" stroke="#B0B5B6" strokeWidth="0.8" fill="none" />
      <path d="M 65 65 Q 62 72 58 72" stroke="#B0B5B6" strokeWidth="0.8" fill="none" />
      {/* Moustache area (light grey blending into beard) */}
      <path
        d="M 43 65 Q 47 67 50 66 Q 53 67 57 65"
        stroke="#A8AEB0"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Cheek warmth ──────────────────────────────────────────────────── */}
      <ellipse cx="38" cy="60" rx="5" ry="3" fill="#C07050" opacity="0.25" />
      <ellipse cx="62" cy="60" rx="5" ry="3" fill="#C07050" opacity="0.25" />
    </svg>
  )
}
