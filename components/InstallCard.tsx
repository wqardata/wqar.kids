import type { InstallSettings } from "@/lib/settingsCore";

/** يستبدل {name} في نص النافذة باسم الموقع. */
export function fillName(text: string, name: string): string {
  return text.replaceAll("{name}", name);
}

export function installIconSrc(i: InstallSettings): string {
  return i.appIconV > 0 ? `/api/app-icon?s=192&v=${i.appIconV}` : "/icons/icon-192.png";
}

type Props = {
  install: InstallSettings;
  name: string;
  /** أيقونة بديلة للمعاينة (قبل الحفظ). */
  iconSrc?: string;
  /** زر التثبيت المباشر متاح (كروم/إيدج/أندرويد)؛ وإلا تُعرض الخطوات اليدوية. */
  canPrompt: boolean;
  safariDesktop?: boolean;
  onInstall?: () => void;
  onClose?: () => void;
};

/** محتوى نافذة التثبيت (يُستعمل في الموقع وفي معاينة لوحة التحكم). */
export default function InstallCard({ install, name, iconSrc, canPrompt, safariDesktop, onInstall, onClose }: Props) {
  return (
    <>
      <div className="install-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc || installIconSrc(install)} alt="" />
        <div>
          <strong>{fillName(install.title, name)}</strong>
          <small>{fillName(install.subtitle, name)}</small>
        </div>
        <button type="button" className="install-x" aria-label="إغلاق" onClick={onClose}>✕</button>
      </div>
      {canPrompt ? (
        <button type="button" className="btn" onClick={onInstall}>{fillName(install.button, name)}</button>
      ) : (
        <p className="install-steps">
          {safariDesktop ? (
            <>من قائمة <b>ملف</b> في سفاري اختر <b>«إضافة إلى Dock»</b>.</>
          ) : (
            <>اضغط زر المشاركة <b>⎋</b> في أسفل سفاري، ثم اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</>
          )}
        </p>
      )}
    </>
  );
}
