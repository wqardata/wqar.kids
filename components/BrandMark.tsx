import type { SiteSettings } from "@/lib/settings";

/** شعار الموقع واسمه (يُستخدم في الهيدر ومعاينة لوحة التحكم). */
export default function BrandMark({ s }: { s: SiteSettings }) {
  return (
    <>
      {s.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.logo} alt="" className="brand-logo" style={{ height: s.logoHeight }} />
      )}
      {(!s.logo || s.showName) && <span className="brand-name">{s.siteName || "اسم الموقع"}</span>}
    </>
  );
}
