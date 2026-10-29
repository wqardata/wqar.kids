"use client";
import { useMemo, useState } from "react";
import {
  DEFAULT_DRIVE_TIP_TEXT,
  DEFAULT_WATCH_PAGE,
  DRIVE_BTN_SCALE_MAX,
  DRIVE_BTN_SCALE_MIN,
  DRIVE_TIP_MAX_MAX,
  DRIVE_TIP_SEC_MAX,
  DRIVE_TIP_SEC_MIN,
  DRIVE_TIP_TEXT_MAX,
  PLAY_BTN_SCALE_MAX,
  PLAY_BTN_SCALE_MIN,
  SUG_COUNT_MAX,
  SUG_LAYOUTS,
  SUG_ORDERS,
  SUG_POOLS,
  type SugPool,
  DRIVE_TIP_POSITIONS,
  DRIVE_TIP_OPACITY_MIN,
  type DriveTipPos,
  SUG_SCOPES,
  cleanWatchPage,
  useSettings,
  type SugLayout,
  type SugOrder,
  type SugScope,
  type WatchPageSettings,
} from "@/lib/settings";
import { DRIVE_TIP_KEY } from "@/lib/driveVideo";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerForm } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

type FlagKey = { [K in keyof WatchPageSettings]: WatchPageSettings[K] extends boolean ? K : never }[keyof WatchPageSettings];

/** الفيديوهات المقترحة في صفحة الفيديو: العدد وطريقة العرض والصلة بالفيديو المشغَّل ومعايير الاختيار. */
export default function SuggestedSettings() {
  const { settings, ready } = useSettings();
  const [form, setForm] = useState<WatchPageSettings>(settings.watchPage);
  const [tipReset, setTipReset] = useState(false);
  usePreviewDraft("watch-page", { watchPage: cleanWatchPage(form) });
  const patch = useMemo(() => ({ watchPage: cleanWatchPage(form) }), [form]);
  useSettingsOwner({
    patch,
    afterSave: (saved) => setForm(saved.watchPage),
    reset: () => setForm(DEFAULT_WATCH_PAGE),
  });

  const set = <K extends keyof WatchPageSettings>(k: K, v: WatchPageSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };
  const int = (raw: string, lo: number, hi: number) => {
    const n = Math.round(Number(raw));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
  };
  const flag = (k: FlagKey, label: string, hint?: string) => (
    <div>
      <label className="check">
        <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );

  if (!ready) return null;

  const mix = form.sugOrder === "mix";

  return (
    <OwnerForm>
    <MovableSection id="watch.drive">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-s-drive">
        <h2 id="sg-s-drive">مشغّل درايف على الجوال</h2>
        <div className="field">
          <label htmlFor="sg-dz">حجم الأزرار ({form.driveBtnScale}%)</label>
          <input
            id="sg-dz"
            type="range"
            dir="ltr"
            min={DRIVE_BTN_SCALE_MIN}
            max={DRIVE_BTN_SCALE_MAX}
            step={5}
            value={form.driveBtnScale}
            onChange={(e) => set("driveBtnScale", int(e.target.value, DRIVE_BTN_SCALE_MIN, DRIVE_BTN_SCALE_MAX))}
          />
          <p className="hint">100% = حجم أزرار درايف الأصلي، أقل = أصغر، وأكثر من 100% = أكبر. الأزرار داخل إطار درايف نفسه (ومنها التشغيل/الإيقاف) لا تُنسَّق منفردة، لكن تصغير النسبة يصغّرها ويوسّع الإطار فيتسع شريط درايف في سطر واحد؛ جرّب 40–60% إن ظهر الزر في سطر ثانٍ. يسري على الجوال فقط (الشاشات الأقل من 600px)، والافتراضي 80%.</p>
        </div>
        <div className="field">
          <label htmlFor="sg-pb">حجم زر التشغيل/الإيقاف في المنتصف ({form.playBtnScale}%)</label>
          <input
            id="sg-pb"
            type="range"
            dir="ltr"
            min={PLAY_BTN_SCALE_MIN}
            max={PLAY_BTN_SCALE_MAX}
            step={10}
            value={form.playBtnScale}
            onChange={(e) => set("playBtnScale", int(e.target.value, PLAY_BTN_SCALE_MIN, PLAY_BTN_SCALE_MAX))}
          />
          <p className="hint">يتحكم بحجم الزر الأوسط في مشغّل يوتيوب. زر درايف الأوسط جزء من إطار درايف نفسه فيتبع «حجم الأزرار» أعلاه. الافتراضي 100%.</p>
        </div>
      </div>
    </MovableSection>
    <MovableSection id="watch.tip">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-s-tip">
        <h2 id="sg-s-tip">مشغّل درايف الخاص: فقاعة «المشاهدة عبر Drive»</h2>
        <p className="hint">فقاعة صغيرة مؤقتة تشير إلى أيقونة درايف في المشغّل الخاص وتظهر عند أول تشغيل، لتعريف الزائر بأن الضغط عليها يفتح مشغّل درايف الأصلي لتغيير الجودة.</p>
        {flag("driveTipShow", "إظهار الفقاعة")}
        {form.driveTipShow && (
          <>
            <div className="field">
              <label htmlFor="sg-tip-text">النص</label>
              <input id="sg-tip-text" value={form.driveTipText} onChange={(e) => set("driveTipText", e.target.value.slice(0, DRIVE_TIP_TEXT_MAX))} maxLength={DRIVE_TIP_TEXT_MAX} placeholder={DEFAULT_DRIVE_TIP_TEXT} />
              <p className="hint">اتركه فارغًا لاستعمال النص الافتراضي. يُفضَّل أن يبقى قصيرًا كي لا يغطي الفيديو.</p>
            </div>
            <div className="field">
              <label htmlFor="sg-tip-pos">مكان الفقاعة</label>
              <select id="sg-tip-pos" value={form.driveTipPos} onChange={(e) => set("driveTipPos", e.target.value as DriveTipPos)}>
                {DRIVE_TIP_POSITIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <p className="hint">«أعلى الشعار» فوق شريط التحكم داخل الفيديو (الافتراضي). «أسفل الشعار» تنزل تحت المشغّل (وفي ملء الشاشة تظهر أعلى الشعار).</p>
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="sg-tip-color">لون الفقاعة</label>
                <div className="addrow">
                  <input id="sg-tip-color" type="color" value={form.driveTipColor || "#087a68"} onChange={(e) => set("driveTipColor", e.target.value)} />
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("driveTipColor", "")} disabled={!form.driveTipColor}>لون الموقع الأساسي</button>
                </div>
                <p className="hint">{form.driveTipColor ? "لون النص يُضبط تلقائيًا ليبقى مقروءًا." : "الآن: لون الموقع الأساسي."}</p>
              </div>
              <div className="field">
                <label htmlFor="sg-tip-op">الشفافية: العتامة {form.driveTipOpacity}%</label>
                <input id="sg-tip-op" type="range" min={DRIVE_TIP_OPACITY_MIN} max={100} step={5} value={form.driveTipOpacity} onChange={(e) => set("driveTipOpacity", int(e.target.value, DRIVE_TIP_OPACITY_MIN, 100))} />
                <p className="hint">100% = معتمة تمامًا، وأقل = أشفّ (الحد الأدنى {DRIVE_TIP_OPACITY_MIN}%).</p>
              </div>
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="sg-tip-sec">مدة الظهور (ثوانٍ)</label>
                <input id="sg-tip-sec" type="number" inputMode="numeric" dir="ltr" min={DRIVE_TIP_SEC_MIN} max={DRIVE_TIP_SEC_MAX} step={1} value={form.driveTipSec} onChange={(e) => set("driveTipSec", int(e.target.value, DRIVE_TIP_SEC_MIN, DRIVE_TIP_SEC_MAX))} />
              </div>
              <div className="field">
                <label htmlFor="sg-tip-max">أقصى عدد مرات لكل زائر</label>
                <input id="sg-tip-max" type="number" inputMode="numeric" dir="ltr" min={0} max={DRIVE_TIP_MAX_MAX} step={1} value={form.driveTipMax} onChange={(e) => set("driveTipMax", int(e.target.value, 0, DRIVE_TIP_MAX_MAX))} />
                <p className="hint">0 = تظهر في كل مرة يبدأ فيها فيديو. العدّ في متصفح كل زائر ولا يستهلك شيئًا من الخادم.</p>
              </div>
            </div>
            <div className="addrow">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  try { localStorage.removeItem(DRIVE_TIP_KEY); } catch { /* التخزين غير متاح */ }
                  setTipReset(true);
                }}
              >
                إعادة عرض الفقاعة في متصفحي
              </button>
              {tipReset && <small className="hint" role="status">تمّ: ستظهر لك عند تشغيل فيديو درايف في الصفحة. (تسري القيم المحفوظة؛ احفظ التغييرات أولًا.)</small>}
            </div>
          </>
        )}
      </div>
    </MovableSection>
    <MovableSection id="watch.yt">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-s-yt">
        <h2 id="sg-s-yt">مشغّل يوتيوب</h2>
        {flag("ytNoMusic", "اختيار نسخة «بدون موسيقى» تلقائيًا", "يعمل فقط إن كان صاحب الفيديو رفع مسارًا صوتيًا بدون موسيقى ضمن الفيديو نفسه (تعدد المسارات الصوتية)، وإلا يبقى الصوت الأصلي.")}
        {flag("ytMuted", "تشغيل الفيديو بدون صوت (بدون موسيقى)", "الصوت كله يُكتم، فلا يمكن فصل الموسيقى عن الكلام. يستطيع الزائر تشغيل الصوت من زر الصوت في المشغّل.")}
      </div>
    </MovableSection>
    <MovableSection id="watch.suggested">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-h-sug">
        <h2 id="sg-h-sug">الفيديوهات المقترحة</h2>
        <p className="hint">تظهر تحت الفيديو على الجوال، وبجانبه على الشاشات الكبيرة.</p>
        {flag("sugShow", "إظهار قسم الفيديوهات المقترحة")}
      </div>
    </MovableSection>
    {form.sugShow && (
      <>
    <MovableSection id="watch.sugbasic">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-s-basic">
            <h2 id="sg-s-basic">العدد وطريقة العرض</h2>
            <div className="two">
              <div className="field">
                <label htmlFor="sg-count">عدد الفيديوهات</label>
                <input id="sg-count" type="number" inputMode="numeric" dir="ltr" min={1} max={SUG_COUNT_MAX} step={1} value={form.sugCount} onChange={(e) => set("sugCount", int(e.target.value, 1, SUG_COUNT_MAX))} />
              </div>
              <div className="field">
                <label htmlFor="sg-layout">طريقة العرض</label>
                <select id="sg-layout" value={form.sugLayout} onChange={(e) => set("sugLayout", e.target.value as SugLayout)}>
                  {SUG_LAYOUTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="sg-title">عنوان القسم</label>
              <input id="sg-title" value={form.sugTitle} onChange={(e) => set("sugTitle", e.target.value)} maxLength={60} placeholder="فيديوهات مقترحة" />
              <p className="hint">اتركه فارغًا لإخفاء العنوان.</p>
            </div>
          </div>
    </MovableSection>
    <MovableSection id="watch.sugrel">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-s-rel">
            <h2 id="sg-s-rel">الصلة بالفيديو المشغَّل</h2>
            <div className="field">
              <label htmlFor="sg-scope">مصدر المقترحات</label>
              <select id="sg-scope" value={form.sugScope} onChange={(e) => set("sugScope", e.target.value as SugScope)}>
                {SUG_SCOPES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <p className="hint">إن لم يوجد شيء في المجموعة أو التصنيف المحدّد تُكمَل القائمة ببقية الفيديوهات.</p>
            </div>
            {flag("sugPrioSeries", "تقديم فيديوهات نفس المجموعة")}
            {flag("sugPrioCategory", "تقديم فيديوهات نفس التصنيف")}
            {flag("sugNextFirst", "الحلقة التالية من نفس المجموعة أولًا", "تُحدَّد بالموسم ثم رقم الحلقة المسجّلين في تعديل الفيديو.")}
          </div>
    </MovableSection>
    <MovableSection id="watch.sugcrit">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-s-crit">
            <h2 id="sg-s-crit">معايير الاختيار والترتيب</h2>
            <div className="field">
              <label htmlFor="sg-pool">الاختيار من</label>
              <select id="sg-pool" value={form.sugPool} onChange={(e) => set("sugPool", e.target.value as SugPool)}>
                {SUG_POOLS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <p className="hint">المقترحات (حتى العشوائية) تُختار من هذه الفيديوهات فقط؛ ما هو أقدم لا يظهر. «الجميع» أكثر تنويعًا لكنه يحمّل كل فيديوهاتك لكل زائر عند فتح فيديو (يُخزَّن 15 دقيقة في متصفحه)، فاختره إن كان عددها ليس كبيرًا.</p>
            </div>
            <div className="field">
              <label htmlFor="sg-order">الترتيب</label>
              <select id="sg-order" value={form.sugOrder} onChange={(e) => set("sugOrder", e.target.value as SugOrder)}>
                {SUG_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            {mix && (
              <div className="field">
                <label htmlFor="sg-rel">عدد الأقرب للفيديو الحالي في البداية</label>
                <input id="sg-rel" type="number" inputMode="numeric" dir="ltr" min={0} max={form.sugCount} step={1} value={Math.min(form.sugRelated, form.sugCount)} onChange={(e) => set("sugRelated", int(e.target.value, 0, form.sugCount))} />
                <p className="hint">الباقي ({Math.max(0, form.sugCount - form.sugRelated)}) يُختار عشوائيًا من بقية الفيديوهات.</p>
              </div>
            )}
            {flag("sugHideWatched", "إخفاء ما أكمل الزائر مشاهدته", "يعتمد على سجل المشاهدة في متصفح كل زائر.")}
            {flag("sugShorts", "تضمين المقاطع القصيرة")}
          </div>
    </MovableSection>
    <MovableSection id="watch.sugshow">
      <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-s-show">
            <h2 id="sg-s-show">ما يظهر على كل فيديو</h2>
            {flag("sugShowDuration", "مدة الفيديو على الصورة")}
            {flag("sugShowSeries", "اسم المجموعة")}
            {flag("sugShowEpisode", "الموسم والحلقة")}
            {flag("sugShowViews", "المشاهدات ووقت النشر")}
          </div>
    </MovableSection>
      </>
    )}
    </OwnerForm>
  );
}
