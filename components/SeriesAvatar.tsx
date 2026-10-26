/** صورة المجموعة الدائرية (كصورة القناة في يوتيوب). بلا صورة: دائرة بأول حرف من اسم المجموعة. */
export default function SeriesAvatar({ name, url, size = 36 }: { name: string; url?: string; size?: number }) {
  const hue = Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="s-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.46), ["--h" as string]: hue }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
      ) : null}
      <span>{Array.from(name.trim())[0] ?? ""}</span>
    </span>
  );
}
