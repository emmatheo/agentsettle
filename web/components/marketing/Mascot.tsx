/**
 * AgentSettle mascot — a hand-drawn SVG "settlement sentinel": a shield-bot
 * whose chest carries a lock, signalling policy-guarded custody. Pure vector,
 * no 3D/AI render. Colors are the landing's committed toxic-emerald duotone.
 */
export function Mascot({ className }: { className?: string }) {
  const A = "#3dfb8f"; // accent
  const G = "#6bffa8"; // accent-glow
  const S = "#0f1912"; // surface-2
  const S2 = "#0b120d"; // surface

  return (
    <svg
      className={className}
      viewBox="0 0 240 268"
      fill="none"
      role="img"
      aria-label="AgentSettle sentinel mascot"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* antennae */}
      <path d="M84 40V22" stroke={A} strokeWidth="3" strokeLinecap="round" />
      <path d="M156 40V22" stroke={A} strokeWidth="3" strokeLinecap="round" />
      <circle cx="84" cy="17" r="5" fill={G} />
      <circle cx="156" cy="17" r="5" fill={G} />

      {/* head */}
      <rect x="46" y="40" width="148" height="112" rx="30" fill={S} stroke={A} strokeWidth="3" />
      <rect x="46" y="40" width="148" height="112" rx="30" stroke={A} strokeOpacity="0.25" strokeWidth="9" />

      {/* eyes (blink via .mkt-eye) */}
      <g className="mkt-eye">
        <rect x="74" y="80" width="26" height="30" rx="8" fill={G} />
        <rect x="140" y="80" width="26" height="30" rx="8" fill={G} />
      </g>

      {/* mouth grille */}
      <path d="M96 128h48" stroke={A} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M104 128v6M120 128v6M136 128v6" stroke={A} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.5" />

      {/* neck */}
      <path d="M104 152v14M136 152v14" stroke={A} strokeWidth="3" strokeLinecap="round" />

      {/* body */}
      <rect x="58" y="166" width="124" height="86" rx="26" fill={S2} stroke={A} strokeWidth="3" />

      {/* chest lock — guarded custody */}
      <rect x="102" y="196" width="36" height="30" rx="6" fill={S} stroke={A} strokeWidth="3" />
      <path d="M108 196v-8a12 12 0 0 1 24 0v8" stroke={A} strokeWidth="3" strokeLinecap="round" />
      <circle cx="120" cy="208" r="4" fill={G} />
      <path d="M120 211v6" stroke={A} strokeWidth="3" strokeLinecap="round" />

      {/* arms */}
      <path d="M58 196c-16 2-24 12-24 26" stroke={A} strokeWidth="3" strokeLinecap="round" />
      <path d="M182 196c16 2 24 12 24 26" stroke={A} strokeWidth="3" strokeLinecap="round" />
      <circle cx="33" cy="226" r="6" fill={S} stroke={A} strokeWidth="3" />
      <circle cx="207" cy="226" r="6" fill={S} stroke={A} strokeWidth="3" />
    </svg>
  );
}
