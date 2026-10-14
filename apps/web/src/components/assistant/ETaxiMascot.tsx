/**
 * e-Taxi, the assistant's mascot: a chibi white tourist cab with big windscreen eyes and a
 * marigold roof light, idling in front of an Ellora-style chaitya arch.
 * Poses: idle (gentle bob + blinks), wave (headlights flash, roof light glows: used with the
 * teaser bubble), talk (quicker bob while answering). All motion is CSS (`.etaxi-*` in
 * globals.css) and stops under prefers-reduced-motion, leaving a still frame.
 */
export type MascotPose = "idle" | "wave" | "talk";

export function ETaxiMascot({ pose = "idle", className = "", scene = true }: { pose?: MascotPose; className?: string; scene?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={`etaxi etaxi-${pose} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="etaxi-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ece4d6" />
        </linearGradient>
        <linearGradient id="etaxi-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3946" />
          <stop offset="1" stopColor="#1f1e27" />
        </linearGradient>
        <radialGradient id="etaxi-glow">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {scene && (
        <g>
          <circle cx="60" cy="60" r="58" fill="var(--color-sand-100)" />
          {/* Chaitya arch behind the cab */}
          <path d="M22 96V62a38 38 0 0 1 76 0v34" fill="none" stroke="var(--color-sand-300)" strokeWidth="5" />
          <path d="M34 96V64a26 26 0 0 1 52 0v32" fill="none" stroke="var(--color-sand-200)" strokeWidth="3" />
          <path d="M8 98h104" stroke="var(--color-sand-300)" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
        </g>
      )}

      <g className="etaxi-car">
        {/* shadow */}
        <ellipse cx="60" cy="101" rx="34" ry="4" fill="#16151b" opacity="0.12" className="etaxi-shadow" />
        {/* roof light */}
        <g className="etaxi-rooflight">
          <circle cx="60" cy="33" r="10" fill="url(#etaxi-glow)" className="etaxi-roofglow" />
          <rect x="49" y="29" width="22" height="8" rx="3" fill="var(--color-marigold-400)" stroke="#b97a10" strokeWidth="1" />
          <text x="60" y="35.3" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#5a3a05" fontFamily="system-ui, sans-serif">e-Taxi</text>
        </g>
        {/* body */}
        <path d="M28 64c2-14 10-26 32-26s30 12 32 26l3 2c4 2 5 6 5 10v12c0 4-3 6-6 6H26c-3 0-6-2-6-6V76c0-4 1-8 5-10z" fill="url(#etaxi-body)" stroke="#cbbfa8" strokeWidth="1.2" />
        {/* windscreen with eyes */}
        <path d="M36 64c2-10 8-17 24-17s22 7 24 17z" fill="url(#etaxi-glass)" />
        <path d="M42 52c4-3 9-4 14-4" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" fill="none" strokeLinecap="round" />
        <g className="etaxi-eyes">
          <ellipse cx="51" cy="57.5" rx="4.6" ry="5.4" fill="#ffffff" />
          <ellipse cx="69" cy="57.5" rx="4.6" ry="5.4" fill="#ffffff" />
          <circle cx="52" cy="58.5" r="2.6" fill="#16151b" className="etaxi-pupil" />
          <circle cx="70" cy="58.5" r="2.6" fill="#16151b" className="etaxi-pupil" />
          <circle cx="53" cy="57.2" r="0.9" fill="#ffffff" />
          <circle cx="71" cy="57.2" r="0.9" fill="#ffffff" />
        </g>
        {/* kumkum stripe */}
        <path d="M22 76h76" stroke="var(--color-kumkum-600)" strokeWidth="4" />
        {/* smile grille */}
        <path d="M50 84c3 3 7 4 10 4s7-1 10-4" stroke="#8c8899" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* headlights */}
        <g className="etaxi-headlights">
          <circle cx="32" cy="83" r="5" fill="#fff7d1" stroke="#cbbfa8" />
          <circle cx="88" cy="83" r="5" fill="#fff7d1" stroke="#cbbfa8" />
          <circle cx="32" cy="83" r="9" fill="url(#etaxi-glow)" className="etaxi-beam" />
          <circle cx="88" cy="83" r="9" fill="url(#etaxi-glow)" className="etaxi-beam" />
        </g>
        {/* cheeks */}
        <circle cx="42" cy="68" r="2.6" fill="var(--color-kumkum-500)" opacity="0.25" />
        <circle cx="78" cy="68" r="2.6" fill="var(--color-kumkum-500)" opacity="0.25" />
        {/* wheels */}
        <rect x="27" y="92" width="14" height="9" rx="3" fill="#2d2b36" />
        <rect x="79" y="92" width="14" height="9" rx="3" fill="#2d2b36" />
        {/* mirrors */}
        <ellipse cx="25" cy="62" rx="4" ry="3" fill="#ffffff" stroke="#cbbfa8" />
        <ellipse cx="95" cy="62" rx="4" ry="3" fill="#ffffff" stroke="#cbbfa8" />
      </g>
    </svg>
  );
}
