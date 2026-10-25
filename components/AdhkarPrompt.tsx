"use client";

type Props = {
  icon: string;
  text: string;
  onDone: () => void;
  onNow: () => void;
  /** تأجيل التذكير (✕). */
  onLater: () => void;
  /** داخل المعاينة: بلا تثبيت أعلى الشاشة. */
  inline?: boolean;
};

/** الإشعار المنبثق الزجاجي: «حان وقت أذكار الصباح/المساء» مع زرّي «قلتها» و«سأقولها الآن». */
export default function AdhkarPrompt({ icon, text, onDone, onNow, onLater, inline }: Props) {
  return (
    <div className={`adhkar-prompt${inline ? " adhkar-prompt--inline" : ""}`} role="status" aria-live="polite">
      <button type="button" className="adhkar-prompt-x" aria-label="ذكّرني لاحقًا" title="ذكّرني لاحقًا" onClick={onLater}>✕</button>
      <span className="adhkar-prompt-ico" aria-hidden="true">{icon}</span>
      <p>{text}</p>
      <div className="adhkar-prompt-btns">
        <button type="button" className="adhkar-btn adhkar-btn--ghost" onClick={onDone}>قلتها</button>
        <button type="button" className="adhkar-btn" onClick={onNow}>سأقولها الآن</button>
      </div>
    </div>
  );
}
