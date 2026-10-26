/** يصغّر الصورة (حتى 512px) ويحوّلها إلى data: URL صغير؛ إعادة الرسم تزيل أي سكربت من SVG. */
export async function fileToLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة (PNG أو SVG أو JPG أو WebP).");
  if (file.size > 5 * 1024 * 1024) throw new Error("الصورة كبيرة؛ الحد الأقصى 5 ميغابايت.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("تعذّر قراءة الصورة."));
      i.src = url;
    });
    const w0 = img.naturalWidth || 512;
    const h0 = img.naturalHeight || 512;
    for (const max of [512, 256]) {
      const k = Math.min(1, max / Math.max(w0, h0));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * k));
      c.height = Math.max(1, Math.round(h0 * k));
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL("image/webp", 0.9);
      if (out.length <= 250_000) return out;
    }
    throw new Error("الصورة معقّدة جدًا؛ جرّب صورة أبسط أو أصغر.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
