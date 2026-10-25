"use client";
import { useEffect, useMemo, useState } from "react";
import { ASR_MODES, CITIES, METHODS, PRAYERS } from "@/lib/adhanCore";
import {
  DEFAULT_PREFS, applyPrefs, effectiveCoords, forgetDevicePosition, readSavedPos, requestDevicePosition, saveRemotePrefs, savePrefs, useAdhanPrefs, type AdhanPrefs,
} from "@/lib/adhanPrefs";
import { timesForDay } from "@/lib/prayer";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";

const clock = (d: Date) => new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);

/** صفحة الزائر الخاصة: الموقع وطريقة الحساب والتنبيه. تُحفظ في متصفحه وتسري فورًا على نافذة الأذان لديه فقط. */
export default function AdhanPrefsPanel() {
  const { settings, ready } = useSettings();
  const { user, loading, configured } = useAuth();
  const saved = useAdhanPrefs();
  const [form, setForm] = useState<AdhanPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<"" | "busy" | "ok" | "denied">("");
  const [done, setDone] = useState<"" | "synced" | "local">("");

  useEffect(() => {
    if (loaded) return;
    setForm(saved);
    setLoaded(true);
  }, [saved, loaded]);
  useEffect(() => setPos(readSavedPos()), [saved]);

  const set = <K extends keyof AdhanPrefs>(k: K, v: AdhanPrefs[K]) => {
    setDone("");
    setForm((f) => ({ ...f, [k]: v }));
  };

  const base = settings.adhan;
  const eff = useMemo(() => applyPrefs(base, form), [base, form]);
  const coords = effectiveCoords(eff, pos);
  const times = useMemo(() => {
    const local = new Date(Date.now() + (coords.lng / 15) * 3600000);
    return timesForDay(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), coords.lat, coords.lng, eff);
  }, [eff, coords.lat, coords.lng]);

  async function persist(p: AdhanPrefs) {
    savePrefs(p);
    setDone(user && (await saveRemotePrefs(user.uid, p)) ? "synced" : "local");
  }

  async function locate() {
    setGeo("busy");
    const p = await requestDevicePosition();
    setGeo(p ? "ok" : "denied");
    if (p) set("location", "auto");
  }

  if (loading || !ready) return <p className="note" role="status">جارٍ التحميل…</p>;
  if (!configured || !user) {
    return (
      <>
        <p className="note">إعدادات الأذان الخاصة متاحة للمستخدمين المسجّلين فقط.</p>
        <Link href="/login" className="btn">تسجيل الدخول</Link>
      </>
    );
  }
  if (!ready) return <p className="note" role="status">جارٍ التحميل…</p>;
  if (!base.enabled) return <p className="note">نافذة الأذان غير مفعّلة في هذا الموقع حاليًا.</p>;

  const cityId = form.cityId || base.cityId;
  const siteMethod = METHODS.find((m) => m.id === base.method)?.label ?? "";
  const siteAsr = ASR_MODES.find((m) => m.id === base.asr)?.label ?? "";

  return (
    <div className="admin-stack">
      <p className="hint">تُحفظ هذه الاختيارات في حسابك فتجدها على أي جهاز تدخل منه، وتسري على نافذة الأذان والتنبيه لديك أنت دون غيرك.</p>

      <section className="panel auth-form" aria-labelledby="ap-loc">
        <h2 id="ap-loc">الموقع</h2>
        <div className="field">
          <label htmlFor="ap-mode">تحديد الموقع</label>
          <select id="ap-mode" value={form.location} onChange={(e) => set("location", e.target.value as AdhanPrefs["location"])}>
            <option value="default">إعداد الموقع الافتراضي</option>
            <option value="auto">تلقائي حسب موقعي</option>
            <option value="city">اختيار المدينة يدويًا</option>
          </select>
        </div>
        {form.location === "city" && (
          <div className="field">
            <label htmlFor="ap-city">المدينة</label>
            <select id="ap-city" value={cityId} onChange={(e) => set("cityId", e.target.value)}>
              {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {eff.locationMode === "auto" && (
          <div className="field">
            <div className="addrow">
              <button type="button" className="btn btn--sm" onClick={() => void locate()} disabled={geo === "busy"}>{geo === "busy" ? "جارٍ التحديد…" : "تحديد موقعي الآن"}</button>
              {pos && <button type="button" className="btn btn--ghost btn--sm" onClick={forgetDevicePosition}>نسيان الموقع المحفوظ</button>}
            </div>
            <p className="hint" role="status">
              {geo === "denied"
                ? "لم يُسمح بتحديد الموقع. فعّل إذن الموقع للموقع من إعدادات المتصفح، وإلا نقدّره من منطقتك الزمنية."
                : pos
                  ? "نستعمل موقع جهازك المحفوظ."
                  : "بلا إذن الموقع نقدّر مكانك من منطقتك الزمنية، وهو تقريب قد يختلف دقائق."}
            </p>
          </div>
        )}
      </section>

      <section className="panel auth-form" aria-labelledby="ap-calc">
        <h2 id="ap-calc">طريقة الحساب</h2>
        <div className="field">
          <label htmlFor="ap-method">جهة الحساب (زاويتا الفجر والعشاء)</label>
          <select id="ap-method" value={form.method} onChange={(e) => set("method", e.target.value as AdhanPrefs["method"])}>
            <option value="">الافتراضي ({siteMethod})</option>
            {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ap-asr">حساب العصر</label>
          <select id="ap-asr" value={form.asr} onChange={(e) => set("asr", e.target.value as AdhanPrefs["asr"])}>
            <option value="">الافتراضي ({siteAsr})</option>
            {ASR_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </section>

      <section className="panel auth-form" aria-labelledby="ap-rem">
        <h2 id="ap-rem">التنبيه قبل الأذان</h2>
        <div className="field">
          <label htmlFor="ap-rmode">التنبيه</label>
          <select
            id="ap-rmode"
            value={form.remindMin === null ? "default" : form.remindMin === 0 ? "off" : "custom"}
            onChange={(e) => set("remindMin", e.target.value === "default" ? null : e.target.value === "off" ? 0 : form.remindMin || 10)}
          >
            <option value="default">الافتراضي ({base.remind ? `${base.remindMin.dhuhr} دقيقة تقريبًا` : "متوقف"})</option>
            <option value="custom">اختيار المدة بنفسي</option>
            <option value="off">بلا تنبيه</option>
          </select>
        </div>
        {form.remindMin !== null && form.remindMin > 0 && (
          <div className="field">
            <label htmlFor="ap-rmin">أنبّهني قبل الأذان بـ {form.remindMin} دقيقة</label>
            <input id="ap-rmin" type="range" min={1} max={60} value={form.remindMin} onChange={(e) => set("remindMin", Number(e.target.value))} />
          </div>
        )}
      </section>

      <section className="panel auth-form" aria-labelledby="ap-times">
        <h2 id="ap-times">مواقيت اليوم بحسب اختيارك</h2>
        {PRAYERS.map((p) => (
          <div className="addrow" key={p.id}>
            <span style={{ minWidth: 70 }}>{p.label}</span>
            <strong dir="ltr">{clock(times[p.id])}</strong>
          </div>
        ))}
        <p className="hint">قارنها بتقويم مسجدك المحلي قبل الاعتماد عليها.</p>
      </section>

      <div className="addrow">
        <button type="button" className="btn" onClick={() => void persist(form)}>حفظ</button>
        <button type="button" className="btn btn--ghost" onClick={() => { setForm(DEFAULT_PREFS); void persist(DEFAULT_PREFS); }}>العودة للافتراضي</button>
      </div>
      {done && <p className="hint" role="status">{done === "synced" ? "تم الحفظ في حسابك ✓" : "تم الحفظ على هذا الجهاز فقط (تعذّر الحفظ في الحساب)."}</p>}
    </div>
  );
}
