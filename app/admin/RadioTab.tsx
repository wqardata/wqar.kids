"use client";
import { useMemo, useState } from "react";
import { RADIO_MAX, RADIO_RAW_MAX, RADIO_TITLE_MAX, cleanRadio, newNasheedId, type Nasheed, type RadioSettings } from "@/lib/radioCore";
import { parseDriveId, parseFolderId } from "@/lib/drive";
import { useAuth } from "@/lib/auth";
import { DEFAULT_SETTINGS, useSettings } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

type FoundRow = { id: string; title: string; exists: boolean; on: boolean };

/** تبويب «إعدادات الإذاعة»: أناشيد صفحة /radio، كل نشيد عنوان ورابط ملف صوتي من درايف. */
export default function RadioTab() {
  const { settings, ready } = useSettings();
  const [form, setForm] = useState<RadioSettings>(settings.radio);
  const items = form.items;
  const setItems = (next: Nasheed[]) => setForm({ items: next });
  const patch = (id: string, p: Partial<Nasheed>) => setItems(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[i], a[j]] = [a[j], a[i]];
    setItems(a);
  };
  const remove = (id: string) => setItems(items.filter((x) => x.id !== id));
  const add = () => items.length < RADIO_MAX && setItems([...items, { id: newNasheedId(), title: "", drive: "" }]);

  const { user } = useAuth();
  const known = new Set(items.map((x) => parseDriveId(x.drive)).filter((x): x is string => Boolean(x)));
  const [mode, setMode] = useState<"link" | "folder">("link");
  const [linkUrl, setLinkUrl] = useState("");
  const [folderUrl, setFolderUrl] = useState("");
  const [deep, setDeep] = useState(true);
  const [found, setFound] = useState<FoundRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const linkId = parseDriveId(linkUrl);
  const folderId = parseFolderId(folderUrl);
  const num = new Intl.NumberFormat("ar-EG");

  async function authed(url: string) {
    if (!user) throw new Error("login");
    const token = await user.getIdToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  }

  /** إضافة نشيد برابط ملف درايف: يُجلب اسمه تلقائيًا (وإن تعذّر يبقى العنوان فارغًا لتكتبه). */
  async function addByLink() {
    if (!linkId) return;
    setErr("");
    setMsg("");
    if (known.has(linkId)) return setErr("هذا النشيد مضاف سابقًا.");
    if (items.length >= RADIO_MAX) return setErr(`الحد الأقصى ${num.format(RADIO_MAX)} نشيدًا.`);
    setBusy(true);
    let title = "";
    try {
      const r = await authed(`/api/drive-info?id=${encodeURIComponent(linkId)}`);
      const j = (await r.json()) as { title?: string | null; warning?: string | null };
      if (r.ok && j.title) title = j.title.slice(0, RADIO_TITLE_MAX);
      else if (j.warning) setMsg(j.warning);
    } catch {
      /* نضيفه بلا عنوان */
    }
    setItems([...items, { id: newNasheedId(), title, drive: linkId }]);
    setLinkUrl("");
    setBusy(false);
    setMsg((m) => m || "أُضيف النشيد إلى آخر القائمة. يُحفظ تلقائيًا.");
  }

  /** قراءة الملفات الصوتية في مجلد درايف (مع المجلدات الفرعية اختياريًا). */
  async function loadFolder() {
    if (!folderId) return;
    setBusy(true);
    setErr("");
    setMsg("");
    setFound([]);
    try {
      const r = await authed(`/api/drive-folder?id=${encodeURIComponent(folderId)}&deep=${deep ? 1 : 0}&kind=audio`);
      const j = (await r.json()) as { items?: { id: string; title: string }[]; error?: string; truncated?: boolean };
      if (!r.ok) return setErr(j.error ?? "تعذّر قراءة المجلد.");
      const rows = (j.items ?? []).map((x) => ({ id: x.id, title: x.title.slice(0, RADIO_TITLE_MAX), exists: known.has(x.id), on: !known.has(x.id) }));
      setFound(rows);
      const dup = rows.filter((x) => x.exists).length;
      setMsg(rows.length ? `وُجد ${num.format(rows.length)} ملفًا صوتيًا${dup ? ` (${num.format(dup)} مضاف سابقًا وغير محدَّد)` : ""}${j.truncated ? " — القائمة مقتطعة عند الحد الأقصى" : ""}.` : "لا ملفات صوتية في هذا المجلد.");
    } catch {
      setErr("تعذّر الاتصال. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  const picked = found.filter((x) => x.on);
  const setRow = (id: string, p: Partial<FoundRow>) => setFound((f) => f.map((x) => (x.id === id ? { ...x, ...p } : x)));
  function addPicked() {
    const room = RADIO_MAX - items.length;
    if (room <= 0) return setErr(`الحد الأقصى ${num.format(RADIO_MAX)} نشيدًا.`);
    const add = picked.slice(0, room).map((x) => ({ id: newNasheedId(), title: x.title.trim(), drive: x.id }));
    setItems([...items, ...add]);
    setFound((f) => f.map((x) => (x.on ? { ...x, exists: true, on: false } : x)));
    setErr("");
    setMsg(`أُضيف ${num.format(add.length)} نشيدًا إلى آخر القائمة${picked.length > room ? ` (الباقي لم يتّسع للحد الأقصى)` : ""}. يُحفظ ذلك تلقائيًا.`);
  }

  usePreviewDraft("radio", { radio: cleanRadio(form) });
  const draftPatch = useMemo(() => ({ radio: cleanRadio(form) }), [form]);
  useSettingsOwner({
    patch: draftPatch,
    // رابط كُتب ولم يُفهم: نخبر المشرف بدل أن يُهمل بصمت عند الحفظ.
    validate: () => {
      const i = items.findIndex((x) => x.drive.trim() && !parseDriveId(x.drive));
      return i >= 0 ? `رابط النشيد رقم ${i + 1} ليس رابط درايف صالحًا.` : "";
    },
    afterSave: (saved) => setForm(saved.radio),
    reset: () => setForm(DEFAULT_SETTINGS.radio),
  });

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <MovableSection id="radio.list">
      <section className="panel panel--wide auth-form" aria-labelledby="rd-h">
        <h2 id="rd-h">أناشيد الإذاعة ({new Intl.NumberFormat("ar-EG").format(items.length)})</h2>
        <p className="hint">
          أضف الأناشيد برابط ملف صوتي من درايف أو باستيراد مجلد كامل (يجب أن تكون المشاركة «أي شخص لديه الرابط – مشاهد»). يظهر الأول في مشغّل صفحة الإذاعة، وتظهر الأناشيد تحته بالترتيب نفسه. الأناشيد التي بلا رابط صالح تُهمل عند الحفظ.
        </p>

        <div role="tablist" aria-label="طريقة إضافة النشيد" className="tabs tabs--sub">
          <button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "tab on" : "tab"} onClick={() => setMode("link")}>🔗 رابط ملف درايف</button>
          <button type="button" role="tab" aria-selected={mode === "folder"} className={mode === "folder" ? "tab on" : "tab"} onClick={() => setMode("folder")}>📁 مجلد درايف</button>
        </div>

        {mode === "link" ? (
          <div className="field">
            <label htmlFor="rd-link">رابط ملف صوتي من درايف</label>
            <div className="addrow">
              <input id="rd-link" type="url" dir="ltr" inputMode="url" placeholder="https://drive.google.com/file/d/…/view" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} autoComplete="off" />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void addByLink()} disabled={!linkId || busy}>{busy ? "جارٍ الإضافة…" : "＋ إضافة"}</button>
            </div>
            {linkUrl.trim() && !linkId && <p className="field-error" role="alert">الرابط لا يبدو رابط ملف من درايف.</p>}
            <p className="hint">يُجلب اسم الملف تلقائيًا ويمكنك تعديله بعد الإضافة.</p>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="rd-folder">رابط مجلد الأناشيد من درايف</label>
            <div className="addrow">
              <input id="rd-folder" type="url" dir="ltr" inputMode="url" placeholder="https://drive.google.com/drive/folders/…" value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} autoComplete="off" />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void loadFolder()} disabled={!folderId || busy}>{busy ? "جارٍ القراءة…" : "عرض أناشيد المجلد"}</button>
            </div>
            {folderUrl.trim() && !folderId && <p className="field-error" role="alert">الرابط لا يبدو رابط مجلد من درايف.</p>}
            <label className="check"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> تضمين المجلدات الفرعية</label>
            <p className="hint">يجب أن يكون المجلد مشاركًا «أي شخص لديه الرابط – مشاهد». تُعرض الملفات الصوتية فقط (mp3 وm4a وwav وغيرها).</p>
            {found.length > 0 && (
              <>
                <div className="addrow">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFound((f) => f.map((x) => ({ ...x, on: !x.exists })))}>تحديد الكل</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFound((f) => f.map((x) => ({ ...x, on: false })))}>إلغاء التحديد</button>
                  <small className="hint">المحدَّد: {num.format(picked.length)}</small>
                </div>
                <ul className="alist import-list">
                  {found.map((x) => (
                    <li key={x.id} className="import-row">
                      <input type="checkbox" aria-label={`إضافة ${x.title}`} checked={x.on} onChange={(e) => setRow(x.id, { on: e.target.checked })} />
                      <div className="arow-info">
                        <input aria-label="العنوان" value={x.title} maxLength={RADIO_TITLE_MAX} onChange={(e) => setRow(x.id, { title: e.target.value })} />
                        {x.exists && <small>مضاف سابقًا</small>}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="addrow">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={addPicked} disabled={picked.length === 0}>＋ إضافة المحدَّد ({num.format(picked.length)}) إلى القائمة</button>
                </div>
              </>
            )}
          </div>
        )}
        {err && <p className="field-error" role="alert">{err}</p>}
        {msg && <p className="hint" role="status">{msg}</p>}

        {items.length === 0 && <p className="hint">لا أناشيد بعد. أضف نشيدًا من الرابط أو من مجلد.</p>}

        {items.map((it, i) => {
          const bad = Boolean(it.drive.trim()) && !parseDriveId(it.drive);
          return (
            <div className="adhkar-ed" key={it.id}>
              <div className="addrow">
                <span className="adhkar-ed-n">{new Intl.NumberFormat("ar-EG").format(i + 1)}</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`رفع النشيد ${i + 1}`}>▲</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`خفض النشيد ${i + 1}`}>▼</button>
                <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => remove(it.id)} aria-label={`حذف النشيد ${i + 1}`}>حذف</button>
              </div>
              <label className="sr-only" htmlFor={`rd-t-${it.id}`}>عنوان النشيد {i + 1}</label>
              <input id={`rd-t-${it.id}`} value={it.title} maxLength={RADIO_TITLE_MAX} placeholder="عنوان النشيد" onChange={(e) => patch(it.id, { title: e.target.value })} />
              <label className="sr-only" htmlFor={`rd-d-${it.id}`}>رابط درايف للنشيد {i + 1}</label>
              <input
                id={`rd-d-${it.id}`}
                dir="ltr"
                value={it.drive}
                maxLength={RADIO_RAW_MAX}
                placeholder="https://drive.google.com/file/d/…/view"
                aria-invalid={bad}
                onChange={(e) => patch(it.id, { drive: e.target.value })}
              />
              {bad && <p className="field-error" role="alert">لم أفهم هذا الرابط: انسخ رابط الملف من درايف (مشاركة ← نسخ الرابط).</p>}
            </div>
          );
        })}

        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={add} disabled={items.length >= RADIO_MAX}>＋ سطر فارغ (إدخال يدوي)</button>
        </div>
      </section>
    </MovableSection>
  );
}
