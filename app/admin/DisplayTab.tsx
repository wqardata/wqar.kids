"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import IconPicker from "./IconPicker";
import SeriesAvatar from "@/components/SeriesAvatar";
import HomeTabsEditor from "./HomeTabsEditor";
import HomeRowsEditor from "./HomeRowsEditor";
import {
  CONTINUE_COUNT_MAX,
  CONTINUE_LAYOUTS,
  CONTINUE_MIN_SEC_MAX,
  CONTINUE_SIZE_DEFAULT,
  CONTINUE_SIZE_MAX,
  CONTINUE_SIZE_MIN,
  DEFAULT_DISPLAY,
  DISPLAY_COUNT_MAX,
  DISPLAY_ROWS_MAX,
  GROUP_ORDERS,
  HOME_ORDERS,
  MOBILE_THUMB_DIM_MAX,
  MOBILE_THUMB_DIM_MIN,
  MOBILE_THUMB_RADII,
  MOBILE_THUMB_RATIOS,
  MOBILE_THUMB_RATIO_MAX,
  MOBILE_THUMB_RATIO_MIN,
  ROW_SIZE_DEFAULT,
  SHORTS_POS_END,
  SHORTS_POS_MAX_ROW,
  cleanDisplay,
  mobileThumbCss,
  mobileThumbRadiusPx,
  parseMobileThumbRatio,
  useSettings,
  type ContinueLayout,
  type DisplaySettings,
  type GroupOrder,
  type HomeOrder,
  type MobileThumbRadius,
  type MobileThumbRatio,
} from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerForm } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

const ROW = 4; // عدد الفيديوهات في الصف على الحاسوب (نفس ثابت الرئيسية)

/** خيارات موضع صف المقاطع القصيرة. */
const SHORTS_POSITIONS: { value: number; label: string }[] = [
  { value: 0, label: "أعلى الصفحة (قبل الفيديوهات)" },
  ...Array.from({ length: SHORTS_POS_MAX_ROW }, (_, i) => ({ value: i + 1, label: `بعد الصف ${i + 1}` })),
  { value: SHORTS_POS_END, label: "في نهاية الصفحة" },
];

/** عيّنات لمعاينة صف «تابع المشاهدة» (بلا قراءة من Firestore). */
const SAMPLES = [
  { title: "مقدمة في السيرة النبوية", series: "السيرة", meta: "1.2 ألف مشاهدة • منذ يومين", dur: "12:40" },
  { title: "أخلاق المسلم في التعامل", series: "الأخلاق", meta: "860 مشاهدة • منذ أسبوع", dur: "8:15" },
  { title: "قصص الأنبياء: نوح عليه السلام", series: "قصص الأنبياء", meta: "3.4 آلاف مشاهدة • منذ شهر", dur: "21:03" },
  { title: "فقه الصلاة: شروطها وأركانها", series: "الفقه", meta: "540 مشاهدة • منذ 3 أسابيع", dur: "15:30" },
  { title: "تدبّر آيات من سورة الكهف", series: "التدبّر", meta: "2.1 ألف مشاهدة • منذ أسبوعين", dur: "10:05" },
  { title: "أحكام الصيام للمبتدئين", series: "الفقه", meta: "970 مشاهدة • منذ شهرين", dur: "18:22" },
];

/** حقل نسبة صورة الفيديو على الجوال: نسب جاهزة + عرض وارتفاع يحدّدهما المشرف (تُحفظ بصيغة "العرض/الارتفاع"). */
function MobileRatioField({ value, onChange }: { value: MobileThumbRatio; onChange: (v: MobileThumbRatio) => void }) {
  const cur = parseMobileThumbRatio(value) ?? { w: 16, h: 9 };
  const [w, setW] = useState(String(cur.w));
  const [h, setH] = useState(String(cur.h));

  // مزامنة الخانتين عند تغيّر القيمة من الخارج (اختيار نسبة جاهزة أو إعادة ضبط).
  useEffect(() => {
    const p = parseMobileThumbRatio(value);
    if (p && (p.w !== Number(w) || p.h !== Number(h))) {
      setW(String(p.w));
      setH(String(p.h));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (nw: string, nh: string) => {
    const id = `${Number(nw)}/${Number(nh)}`;
    if (nw !== "" && nh !== "" && parseMobileThumbRatio(id)) onChange(id);
  };
  const valid = w !== "" && h !== "" && parseMobileThumbRatio(`${Number(w)}/${Number(h)}`) !== null;
  const normalized = parseMobileThumbRatio(value) ? `${cur.w}/${cur.h}` : "";
  const presetId = MOBILE_THUMB_RATIOS.some((r) => r.id === normalized) ? normalized : "";

  return (
    <div className="field">
      <label htmlFor="dp-ratio-w">أبعاد صورة الفيديو على الجوال (العرض : الارتفاع)</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input id="dp-ratio-w" type="number" inputMode="decimal" dir="ltr" aria-label="العرض" min={MOBILE_THUMB_DIM_MIN} max={MOBILE_THUMB_DIM_MAX} step={0.1} value={w} style={{ width: 90 }}
          onChange={(e) => { setW(e.target.value); commit(e.target.value, h); }} />
        <span aria-hidden="true">:</span>
        <input id="dp-ratio-h" type="number" inputMode="decimal" dir="ltr" aria-label="الارتفاع" min={MOBILE_THUMB_DIM_MIN} max={MOBILE_THUMB_DIM_MAX} step={0.1} value={h} style={{ width: 90 }}
          onChange={(e) => { setH(e.target.value); commit(w, e.target.value); }} />
        <select id="dp-ratio" aria-label="نسب جاهزة" value={presetId} onChange={(e) => e.target.value && onChange(e.target.value as MobileThumbRatio)}>
          <option value="">نسبة مخصّصة</option>
          {MOBILE_THUMB_RATIOS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      {!valid && (
        <p className="hint" role="alert">
          أدخل عرضًا وارتفاعًا بين {MOBILE_THUMB_DIM_MIN} و{MOBILE_THUMB_DIM_MAX} بحيث تكون النسبة بين 1:{1 / MOBILE_THUMB_RATIO_MIN} و{MOBILE_THUMB_RATIO_MAX}:1؛ تبقى آخر نسبة صالحة مطبّقة إلى أن تصحّحها.
        </p>
      )}
      <p className="hint">مثال: 3 و2 تعطي 3:2. تُطبَّق على صور الفيديوهات في الرئيسية (وكذلك صف «تابع المشاهدة») عند التصفح من الجوال فقط؛ الحاسوب يبقى 16:9. تظهر في معاينة «تابع المشاهدة» بوضع «جوال».</p>
    </div>
  );
}

/** معاينة حيّة لصف «تابع المشاهدة»: بنفس أصناف CSS الفعلية، على عرض جوال أو حاسوب. */
function ContinuePreview({ form }: { form: DisplaySettings }) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const n = Math.min(form.continueCount, 6);
  const rows = form.continueLayout === "rows";
  const style = { "--cont-w": `${form.continueSize}px` } as CSSProperties;
  return (
    <div className="cont-prev-wrap">
      <div className="cont-prev-bar">
        <strong>معاينة</strong>
        <div className="seg" role="radiogroup" aria-label="حجم الشاشة في المعاينة">
          {([["phone", "جوال"], ["desktop", "حاسوب"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={device === id} className={device === id ? "on" : ""} onClick={() => setDevice(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className={`cont-prev cont-prev--${device}`} style={style} aria-label="معاينة صف تابع المشاهدة">
        {form.continueTitle && <p className="cont-prev-title">{form.continueTitle}</p>}
        <ul className={rows ? "grid cont-prev-grid" : "cont-row"}>
          {Array.from({ length: n }, (_, i) => {
            const m = SAMPLES[i % SAMPLES.length];
            return (
              <li key={i}>
                <div className="card">
                  <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360, ...(device === "phone" ? { aspectRatio: mobileThumbCss(form.mobileThumbRatio), borderRadius: mobileThumbRadiusPx(form.mobileThumbRadius) } : {}) }}>
                    <span className="dur">{m.dur}</span>
                  </div>
                  <div className="card-row">
                    <SeriesAvatar name={m.series} size={36} />
                    <div className="card-text">
                      <h3>{m.title}</h3>
                      <p>{m.series}</p>
                      <p className="meta">{m.meta}</p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="hint">
        {rows
          ? device === "phone"
            ? "على الجوال تظهر الصفوف مربعًا واحدًا في كل صف (الحجم لا يؤثر هنا)."
            : "في الصفوف يحدّد الحجم أقل عرض للمربع، فيزداد عدد المربعات في الصف كلما صغّرته."
          : "في الشريط الأفقي يحدّد الحجم عرض المربع الواحد (لا يتجاوز 86% من عرض الشاشة)."}
      </p>
    </div>
  );
}

/** قسم داخل مربع الرئيسية: عنوان بشارة ملوّنة وفاصل مميّز قبله. */
const SECTION_IDS: Record<string, string> = { "dp-s-tabs": "display.tabs", "dp-s-cont": "display.cont", "dp-s-rows": "display.rows", "dp-s-shorts": "display.shorts" };
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <MovableSection id={SECTION_IDS[id]}>
      <div className="panel panel--wide auth-form dbox">
        <section className="dsec" aria-labelledby={id}>
          <h3 id={id} className="dsec-h">{title}</h3>
          {children}
        </section>
      </div>
    </MovableSection>
  );
}

/** تبويب «العرض» (التنظيم ← العرض): مربع للصفحة الرئيسية وما يتعلق بها (بأقسام مفصولة)، ومربع للمجموعات. */
export default function DisplayTab() {
  const { settings, ready } = useSettings();
  const [form, setForm] = useState<DisplaySettings>(settings.display);
  usePreviewDraft("display", { display: cleanDisplay(form) });
  const patch = useMemo(() => ({ display: cleanDisplay(form) }), [form]);
  useSettingsOwner({
    patch,
    afterSave: (saved) => setForm(saved.display),
    reset: () => setForm(DEFAULT_DISPLAY),
  });

  const set = <K extends keyof DisplaySettings>(k: K, v: DisplaySettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };
  const num = (k: "homeRows" | "newCount" | "popularCount" | "continueCount" | "continueMinSec", raw: string, max: number, min = 0) => {
    const n = Math.round(Number(raw));
    set(k, Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
  };

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  // عدد صفوف المجموعة الأولى (الجديد + الأكثر مشاهدة): نعدّ الصفوف حتى تتّسع للعدد المطلوب.
  const wantTop = form.newCount + form.popularCount;
  let topRows = 0;
  for (let t = 0; t < wantTop; topRows++) t += form.homeRowsCustom ? form.homeRowSizes[topRows] ?? ROW_SIZE_DEFAULT : ROW;

  return (
    <OwnerForm>
      {/* ───────── مربع الصفحة الرئيسية ───────── */}
        <Section id="dp-s-tabs" title="التبويبات أعلى الصفحة">
          <HomeTabsEditor custom={form.homeTabsCustom} tabs={form.homeTabs} onChange={(custom, tabs) => { setForm((f) => ({ ...f, homeTabsCustom: custom, homeTabs: tabs })); }} />
        </Section>

        <Section id="dp-s-cont" title="صف «تابع المشاهدة»">
          <label className="check">
            <input type="checkbox" checked={form.continueShow} onChange={(e) => set("continueShow", e.target.checked)} /> إظهار آخر الفيديوهات التي فتحها الزائر ولم يُكمِلها (قبل صفوف الفيديوهات)
          </label>
          {form.continueShow && (
            <>
              <div className="two">
                <div className="field">
                  <label htmlFor="dp-cc">عدد الفيديوهات</label>
                  <input id="dp-cc" type="number" inputMode="numeric" dir="ltr" min={1} max={CONTINUE_COUNT_MAX} step={1} value={form.continueCount} onChange={(e) => num("continueCount", e.target.value, CONTINUE_COUNT_MAX, 1)} />
                </div>
                <div className="field">
                  <label htmlFor="dp-cl">طريقة العرض</label>
                  <select id="dp-cl" value={form.continueLayout} onChange={(e) => set("continueLayout", e.target.value as ContinueLayout)}>
                    {CONTINUE_LAYOUTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="dp-size">حجم مربعات الفيديو: {form.continueSize === CONTINUE_SIZE_DEFAULT ? "الافتراضي" : `${form.continueSize}px`}</label>
                <input id="dp-size" type="range" min={CONTINUE_SIZE_MIN} max={CONTINUE_SIZE_MAX} step={10} value={form.continueSize} onChange={(e) => set("continueSize", Number(e.target.value))} />
                <p className="hint">من صغير ({CONTINUE_SIZE_MIN}px) إلى كبير ({CONTINUE_SIZE_MAX}px). جرّب وراقب المعاينة أدناه.</p>
                {form.continueSize !== CONTINUE_SIZE_DEFAULT && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("continueSize", CONTINUE_SIZE_DEFAULT)}>استعادة الحجم الافتراضي</button>
                )}
              </div>
              <ContinuePreview form={form} />
              <div className="field">
                <label htmlFor="dp-cm">أقل مدة مشاهدة ليظهر الفيديو (بالثواني)</label>
                <input id="dp-cm" type="number" inputMode="numeric" dir="ltr" min={0} max={CONTINUE_MIN_SEC_MAX} step={1} value={form.continueMinSec} onChange={(e) => num("continueMinSec", e.target.value, CONTINUE_MIN_SEC_MAX)} />
                <p className="hint">0 = يظهر أي فيديو سبق فتحه ولم يكتمل. ارفع الرقم لتجاهل الفتح العابر.</p>
              </div>
              <div className="field">
                <label htmlFor="dp-ct">العنوان فوق الصف</label>
                <input id="dp-ct" value={form.continueTitle} onChange={(e) => set("continueTitle", e.target.value)} maxLength={60} placeholder="مثال: تابع المشاهدة" />
              </div>
              <IconPicker id="dp-ci" label="أيقونة العنوان" value={form.iconContinue} onChange={(v) => set("iconContinue", v)} />
              <p className="hint">يعتمد الصف على سجل المشاهدة في متصفح كل زائر. يختفي الفيديو من الصف عند بلوغ نحو 90% من مدته (الوقت تقديري لأن مشغّل درايف لا يكشف موضع التشغيل الفعلي). لا يظهر الصف لمن لم يفتح أي فيديو بعد، ولا يظهر داخل تبويب غير «الكل».</p>
            </>
          )}
        </Section>

        <Section id="dp-s-rows" title="صفوف الفيديوهات">
          <HomeRowsEditor
            custom={form.homeRowsCustom}
            sizes={form.homeRowSizes}
            more={form.homeRowsMore}
            onChange={(p) => { setForm((f) => ({ ...f, ...p })); }}
          />
          {!form.homeRowsCustom && (
            <div className="field">
              <label htmlFor="dp-rows">عدد الصفوف في الرئيسية</label>
              <input id="dp-rows" type="number" inputMode="numeric" dir="ltr" min={0} max={DISPLAY_ROWS_MAX} step={1} value={form.homeRows} onChange={(e) => num("homeRows", e.target.value, DISPLAY_ROWS_MAX)} />
              <p className="hint">الصف الواحد = {ROW} فيديوهات على الحاسوب. اكتب 0 لعرض كل الفيديوهات مع التحميل التدريجي عند النزول.</p>
            </div>
          )}

          <div className="two">
            <div className="field">
              <label htmlFor="dp-new">عدد الفيديوهات الجديدة</label>
              <input id="dp-new" type="number" inputMode="numeric" dir="ltr" min={0} max={DISPLAY_COUNT_MAX} step={1} value={form.newCount} onChange={(e) => num("newCount", e.target.value, DISPLAY_COUNT_MAX)} />
            </div>
            <div className="field">
              <label htmlFor="dp-pop">عدد الأكثر مشاهدة</label>
              <input id="dp-pop" type="number" inputMode="numeric" dir="ltr" min={0} max={DISPLAY_COUNT_MAX} step={1} value={form.popularCount} onChange={(e) => num("popularCount", e.target.value, DISPLAY_COUNT_MAX)} />
            </div>
          </div>
          <p className="hint">
            هذان العددان يكوّنان المجموعة الأولى من الصفوف ({topRows === 0 ? "لا صفوف" : `${topRows} ${topRows === 1 ? "صف" : topRows === 2 ? "صفان" : "صفوف"}`})؛ تُكمَل خانات آخر صف فيها بفيديوهات أخرى، وتبدأ بعدها المجموعة الثانية ببقية الفيديوهات.
          </p>

          <div className="field">
            <label htmlFor="dp-order">طريقة العرض</label>
            <select id="dp-order" value={form.homeOrder} onChange={(e) => set("homeOrder", e.target.value as HomeOrder)}>
              {HOME_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <MobileRatioField value={form.mobileThumbRatio} onChange={(v) => set("mobileThumbRatio", v)} />

          <div className="field">
            <label htmlFor="dp-radius">استدارة حواف صورة الفيديو على الجوال</label>
            <select id="dp-radius" value={form.mobileThumbRadius} onChange={(e) => set("mobileThumbRadius", e.target.value as MobileThumbRadius)}>
              {MOBILE_THUMB_RADII.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <p className="hint">تُطبَّق مع الأبعاد أعلاه على الجوال فقط، وتظهر في المعاينة بوضع «جوال».</p>
          </div>

          <div className="field">
            <label htmlFor="dp-t1">عنوان يسبق المجموعة الأولى من الصفوف</label>
            <input id="dp-t1" value={form.titleTop} onChange={(e) => set("titleTop", e.target.value)} maxLength={60} placeholder="مثال: الجديد والأكثر مشاهدة" />
          </div>
          <IconPicker id="dp-i1" label="أيقونة العنوان" value={form.iconTop} onChange={(v) => set("iconTop", v)} />
          <div className="field">
            <label htmlFor="dp-t2">عنوان يسبق بقية الصفوف</label>
            <input id="dp-t2" value={form.titleRest} onChange={(e) => set("titleRest", e.target.value)} maxLength={60} placeholder="مثال: المزيد من الفيديوهات" />
            <p className="hint">اتركهما فارغين لعدم إظهار أي عنوان (والأيقونة تظهر مع العنوان فقط).</p>
          </div>
          <IconPicker id="dp-i2" label="أيقونة العنوان" value={form.iconRest} onChange={(v) => set("iconRest", v)} />
        </Section>

        <Section id="dp-s-shorts" title="صف المقاطع القصيرة">
          <label className="check">
            <input type="checkbox" checked={form.shortsShow} onChange={(e) => set("shortsShow", e.target.checked)} /> إظهار صف المقاطع القصيرة في الرئيسية
          </label>
          {form.shortsShow && (
            <>
              <div className="field">
                <label htmlFor="dp-shorts">مكان صف المقاطع القصيرة</label>
                <select id="dp-shorts" value={form.shortsPos} onChange={(e) => set("shortsPos", Number(e.target.value))}>
                  {SHORTS_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <p className="hint">إن كان عدد الفيديوهات أقل من الصف المحدّد يظهر الصف في النهاية.</p>
              </div>
              <div className="field">
                <label htmlFor="dp-st">عنوان صف المقاطع القصيرة</label>
                <input id="dp-st" value={form.shortsTitle} onChange={(e) => set("shortsTitle", e.target.value)} maxLength={60} placeholder="مقاطع قصيرة" />
              </div>
              <IconPicker id="dp-is" label="أيقونة العنوان" value={form.iconShorts} onChange={(v) => set("iconShorts", v)} />
            </>
          )}
        </Section>

      {/* ───────── مربع المجموعات ───────── */}
      <MovableSection id="display.groups">
      <section className="panel panel--wide auth-form dbox" aria-labelledby="dp-h-group">
        <h2 id="dp-h-group">المجموعات</h2>
        <div className="field">
          <label htmlFor="dp-group">ترتيب الفيديوهات داخل المجموعة</label>
          <select id="dp-group" value={form.groupOrder} onChange={(e) => set("groupOrder", e.target.value as GroupOrder)}>
            {GROUP_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <p className="hint">يُطبَّق على صفحة كل مجموعة (/series).</p>
        </div>
        <div className="dsec">
          <label className="check">
            <input type="checkbox" checked={form.seriesShowDuration} onChange={(e) => set("seriesShowDuration", e.target.checked)} /> إظهار إجمالي مدة الحلقات على بطاقة كل مجموعة في «مجموعاتي»
          </label>
          <p className="hint">المدة = مجموع مدد فيديوهات المجموعة المحسوبة مسبقًا (الفيديو الذي لم تُحسب مدته لا يدخل في المجموع). صورة المجموعة تُضبط من «إدارة المحتوى ← المجموعات ← تعديل» (من فيديو، أو رفع من الجهاز، أو رابط درايف).</p>
        </div>
      </section>
      </MovableSection>

    </OwnerForm>
  );
}
