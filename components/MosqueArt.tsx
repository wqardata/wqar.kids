/** رسم مسجد كرتوني بسيط (SVG مدمج، بلا ملفات صور). */
export default function MosqueArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 220" role="img" aria-label="مسجد" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b3a5c" />
          <stop offset="1" stopColor="#4f7fae" />
        </linearGradient>
        <linearGradient id="ms-dome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fd0b0" />
          <stop offset="1" stopColor="#0e8f78" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" rx="22" fill="url(#ms-sky)" />
      {/* نجوم */}
      {[[30, 34], [62, 70], [270, 28], [236, 62], [292, 90], [118, 22], [200, 26]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 3} fill="#fff7c2" opacity=".9" />
      ))}
      {/* هلال */}
      <path d="M52 40a22 22 0 1 0 22 30a17 17 0 1 1-22-30z" fill="#ffe27a" />
      {/* الأرض */}
      <rect y="186" width="320" height="34" fill="#e9d6a5" />
      <rect y="186" width="320" height="6" fill="#d8c18a" />
      {/* المآذن */}
      {[64, 256].map((x) => (
        <g key={x}>
          <rect x={x - 12} y="86" width="24" height="102" rx="4" fill="#f7efe0" stroke="#cdbb93" strokeWidth="2" />
          <rect x={x - 17} y="82" width="34" height="9" rx="3" fill="#e4d3ac" />
          <path d={`M${x - 12} 82 Q${x} 44 ${x + 12} 82z`} fill="url(#ms-dome)" />
          <path d={`M${x} 44 v-14`} stroke="#ffd34d" strokeWidth="3" strokeLinecap="round" />
          <circle cx={x} cy="28" r="4" fill="#ffd34d" />
          <rect x={x - 4} y="104" width="8" height="16" rx="4" fill="#4f7fae" />
          <rect x={x - 4} y="132" width="8" height="16" rx="4" fill="#4f7fae" />
        </g>
      ))}
      {/* المبنى */}
      <rect x="92" y="128" width="136" height="60" rx="4" fill="#fbf4e4" stroke="#cdbb93" strokeWidth="2" />
      {/* القبّة الكبيرة */}
      <path d="M104 128 A56 56 0 0 1 216 128z" fill="url(#ms-dome)" />
      <path d="M160 72 v-16" stroke="#ffd34d" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M160 44a9 9 0 1 0 9 12a7 7 0 1 1-9-12z" fill="#ffd34d" />
      {/* الباب والنوافذ */}
      <path d="M144 188 v-30 a16 16 0 0 1 32 0 v30z" fill="#0e8f78" stroke="#0a6b5a" strokeWidth="2" />
      {[108, 196].map((x) => (
        <path key={x} d={`M${x} 160 v-12 a8 8 0 0 1 16 0 v12z`} fill="#4f7fae" stroke="#35618c" strokeWidth="1.5" />
      ))}
      {/* وجه كرتوني مبتسم على القبّة */}
      <circle cx="146" cy="112" r="3.4" fill="#073d33" />
      <circle cx="174" cy="112" r="3.4" fill="#073d33" />
      <path d="M150 121 q10 9 20 0" fill="none" stroke="#073d33" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
