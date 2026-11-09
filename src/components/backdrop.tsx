// Decorative, fixed background: deep indigo with glowing blobs and glossy 3D-looking ribbons.
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <svg className="ribbons" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="rg1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd36b" />
            <stop offset=".45" stopColor="#ff8a3d" />
            <stop offset="1" stopColor="#ff4d8d" />
          </linearGradient>
          <linearGradient id="rg2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7b5cff" />
            <stop offset=".5" stopColor="#c04dff" />
            <stop offset="1" stopColor="#ff6fb5" />
          </linearGradient>
          <linearGradient id="hl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5" /></filter>
        </defs>
        {/* warm loop */}
        <g filter="url(#soft)">
          <path d="M760 120 C 1080 40, 1320 260, 1180 470 C 1060 650, 820 600, 860 430 C 900 270, 1180 300, 1240 520 C 1290 700, 1120 860, 900 820" fill="none" stroke="url(#rg1)" strokeWidth="58" strokeLinecap="round" />
          <path d="M760 120 C 1080 40, 1320 260, 1180 470 C 1060 650, 820 600, 860 430" fill="none" stroke="url(#hl)" strokeWidth="10" strokeLinecap="round" opacity=".55" />
        </g>
        {/* violet loop */}
        <g filter="url(#soft)">
          <path d="M-60 640 C 160 520, 420 560, 470 720 C 520 880, 300 940, 220 820 C 140 700, 330 560, 560 600 C 760 640, 820 820, 1000 880" fill="none" stroke="url(#rg2)" strokeWidth="46" strokeLinecap="round" />
          <path d="M-60 640 C 160 520, 420 560, 470 720" fill="none" stroke="url(#hl)" strokeWidth="8" strokeLinecap="round" opacity=".5" />
        </g>
        {/* thin accent strands */}
        <path d="M120 80 C 360 -20, 640 120, 560 300 C 500 430, 300 380, 360 260" fill="none" stroke="url(#rg2)" strokeWidth="14" strokeLinecap="round" opacity=".8" />
        <path d="M1300 40 C 1420 160, 1400 300, 1280 340" fill="none" stroke="url(#rg1)" strokeWidth="10" strokeLinecap="round" opacity=".85" />
      </svg>
    </div>
  );
}
