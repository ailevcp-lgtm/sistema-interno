type AileGlyphProps = {
  size?: number | string
  tileRadius?: number
}

export function AileGlyph({
  size = 256,
  tileRadius = 72,
}: AileGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="aile-glyph-gradient"
          x1="28"
          y1="20"
          x2="228"
          y2="236"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6314A7" />
          <stop offset="0.56" stopColor="#7D2BC0" />
          <stop offset="1" stopColor="#E50051" />
        </linearGradient>
      </defs>

      <rect width="256" height="256" rx={tileRadius} fill="url(#aile-glyph-gradient)" />

      <path
        d="M128 42L192 98L168 188H88L64 98L128 42Z"
        fill="white"
      />
      <path
        d="M128 42L160 98H96L128 42Z"
        fill="#F7F2FF"
      />
      <path
        d="M64 98H96L88 188L64 98Z"
        fill="#EFE5FF"
      />
      <path
        d="M192 98H160L168 188L192 98Z"
        fill="#E7DBFF"
      />
      <path
        d="M96 98H160L128 188L96 98Z"
        fill="#D7C2FF"
      />
      <path
        d="M96 98L128 136L160 98H96Z"
        fill="#C7ABFF"
      />
      <path
        d="M128 62L176 103"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M80 103L128 62"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M96 98L128 188L160 98"
        stroke="#9F6EFF"
        strokeOpacity="0.5"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
