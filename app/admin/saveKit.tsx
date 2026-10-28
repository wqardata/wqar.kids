"use client";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { patchDiffers, patchIsDefault, saveSettingsPatch, useSettings, type SiteSettings } from "@/lib/settings";

/**
 * الحفظ الموحّد في لوحة التحكم:
 *  - كل مكوّن إعدادات يسجّل نفسه هنا (useSaveRegistration / useSettingsOwner) بمسودته وطريقة حفظها وإعادتها للافتراضي.
 *  - شريط واحد أعلى التبويب (SaveBar) فيه «حفظ التغييرات» و«العودة إلى الافتراضي» ويعملان على كل ما في التبويب المعروض.
 *  - AdminPanel يسأل المخزن (useSaveStore) عمّا إذا كان في التبويب تعديلات غير محفوظة قبل أي انتقال (UnsavedDialog).
 */
export type SaveReg = {
  /** في المسودة ما يختلف عن المحفوظ. */
  dirty: boolean;
  /** المسودة مطابقة للقيم الافتراضية أصلًا (لا جدوى من «العودة إلى الافتراضي»). */
  isDefault: boolean;
  /** يحفظ المسودة؛ يعيد true عند النجاح، وfalse إن فشل التحقق أو الحفظ (والخطأ يُعلَن في `error`). */
  save: () => Promise<boolean>;
  /** يضع المسودة على القيم الافتراضية دون حفظ. */
  reset: () => void;
  error: string;
  busy: boolean;
};

type SaveApi = {
  register: (id: string, get: () => SaveReg) => () => void;
  notify: () => void;
  saveAll: () => Promise<boolean>;
};

const SaveCtx = createContext<SaveApi | null>(null);
export const SaveProvider = SaveCtx.Provider;
export const useSaveApi = () => useContext(SaveCtx);

export type SaveStore = {
  api: SaveApi;
  /** عدد الأقسام المسجَّلة في التبويب المعروض (صفر = لا شريط حفظ). */
  count: number;
  dirty: boolean;
  busy: boolean;
  allDefault: boolean;
  error: string;
  /** تم الحفظ للتو ولا تعديلات جديدة بعده. */
  saved: boolean;
  saveAll: () => Promise<boolean>;
  resetAll: () => void;
  clearNotice: () => void;
};

export function useSaveStore(): SaveStore {
  const entries = useRef(new Map<string, () => SaveReg>());
  const [, bump] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveAll = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    let ok = true;
    let any = false;
    try {
      // نقرأ كل قسم عند دوره (لا قبل البدء) كي نستعمل أحدث نسخة منه؛ والحفظ يتم بالتتابع فوق آخر نسخة محفوظة.
      for (const get of [...entries.current.values()]) {
        const r = get();
        if (!r.dirty) continue;
        any = true;
        if (!(await r.save())) ok = false;
      }
    } finally {
      setSaving(false);
    }
    if (ok && any) setSaved(true);
    return ok;
  }, []);

  const api = useMemo<SaveApi>(
    () => ({
      register(id, get) {
        entries.current.set(id, get);
        bump((n) => n + 1);
        return () => {
          entries.current.delete(id);
          bump((n) => n + 1);
        };
      },
      notify() {
        bump((n) => n + 1);
      },
      saveAll,
    }),
    [saveAll],
  );

  const resetAll = useCallback(() => {
    if (!window.confirm("ستُستبدل قيم هذا التبويب بالقيم الافتراضية، ولن يُحفظ شيء حتى تضغط «حفظ التغييرات». متابعة؟")) return;
    for (const get of [...entries.current.values()]) get().reset();
    setSaved(false);
  }, []);

  const clearNotice = useCallback(() => setSaved(false), []);

  const list = [...entries.current.values()].map((g) => g());
  const dirty = list.some((r) => r.dirty);
  // أي تعديل جديد يُخفي رسالة «تم الحفظ».
  useEffect(() => {
    if (dirty) setSaved(false);
  }, [dirty]);

  return {
    api,
    count: list.length,
    dirty,
    busy: saving || list.some((r) => r.busy),
    allDefault: list.every((r) => r.isDefault),
    error: list.map((r) => r.error).find(Boolean) ?? "",
    saved,
    saveAll,
    resetAll,
    clearNotice,
  };
}

/** يسجّل قسمًا في شريط الحفظ طوال بقائه مركَّبًا (يُسحب تلقائيًا عند مغادرة التبويب). */
export function useSaveRegistration(reg: SaveReg) {
  const api = useSaveApi();
  const id = useId();
  const latest = useRef(reg);
  latest.current = reg;
  useEffect(() => api?.register(id, () => latest.current), [api, id]);
  const { dirty, isDefault, error, busy } = reg;
  useEffect(() => {
    api?.notify();
  }, [api, dirty, isDefault, error, busy]);
}

/**
 * الحالة المشتركة بين كل أقسام الإعدادات المحفوظة في مستند settings/site:
 * `patch` هو ما يحرّره القسم (حقول من SiteSettings) — يجب أن يكون ثابتًا بين العروض ما لم تتغيّر المسودة (useMemo).
 */
export function useSettingsOwner({
  patch,
  validate,
  afterSave,
  reset,
}: {
  patch: Partial<SiteSettings>;
  /** يعيد نص الخطأ إن كانت المسودة غير صالحة، وإلا فارغًا. */
  validate?: () => string;
  /** بعد نجاح الحفظ: يعيد المسودة إلى النسخة المنظَّفة المحفوظة. */
  afterSave: (saved: SiteSettings) => void;
  /** يضع المسودة على القيم الافتراضية. */
  reset: () => void;
}) {
  const { settings, update } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = useMemo(() => patchDiffers(settings, patch), [settings, patch]);
  const isDefault = useMemo(() => patchIsDefault(patch), [patch]);
  // أي تعديل جديد في المسودة يُزيل رسالة الخطأ السابقة (الخطأ يخصّ المسودة التي فشلت).
  useEffect(() => setError(""), [patch]);

  const save = async () => {
    setError("");
    const problem = validate?.() ?? "";
    if (problem) {
      setError(problem);
      return false;
    }
    setBusy(true);
    try {
      const saved = await saveSettingsPatch(patch);
      update(saved);
      afterSave(saved);
      return true;
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
      return false;
    } finally {
      setBusy(false);
    }
  };

  useSaveRegistration({
    dirty,
    isDefault,
    error,
    busy,
    save,
    reset: () => {
      setError("");
      reset();
    },
  });

  return { dirty, busy, error, setError };
}

/** الشريط الثابت أعلى الإعدادات: «حفظ التغييرات» و«العودة إلى الافتراضي» وحالة المسودة. */
export function SaveBar({ store }: { store: SaveStore }) {
  if (store.count === 0) return null;
  return (
    <div className="savebar" role="region" aria-label="حفظ التغييرات">
      <div className="savebar-status" aria-live="polite">
        {store.error ? (
          <span className="field-error" role="alert">{store.error}</span>
        ) : store.dirty ? (
          <span className="dirty-dot">● تعديلات غير محفوظة</span>
        ) : store.saved ? (
          <span className="savebar-ok">تم الحفظ ✓</span>
        ) : null}
      </div>
      <div className="savebar-btns">
        <button type="button" className="btn" disabled={!store.dirty || store.busy} onClick={() => void store.saveAll()}>
          {store.busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
        </button>
        <button type="button" className="btn btn--ghost" disabled={store.busy || store.allDefault} onClick={store.resetAll}>
          العودة إلى الافتراضي
        </button>
      </div>
    </div>
  );
}

/** نافذة تحذير عند مغادرة تبويب فيه تعديلات غير محفوظة: حفظ أو تجاهل (أو البقاء). */
export function UnsavedDialog({
  busy,
  error,
  onSave,
  onDiscard,
  onCancel,
}: {
  busy: boolean;
  error: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) cancel.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);

  // حبس التنقّل بـ Tab داخل النافذة.
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !box.current) return;
    const els: HTMLButtonElement[] = Array.from(box.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    if (els.length === 0) return;
    const firstEl = els[0];
    const lastEl = els[els.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  return (
    <div className="unsaved-overlay" onClick={() => !busy && onCancel()}>
      <div
        ref={box}
        className="unsaved-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-t"
        aria-describedby="unsaved-d"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trap}
      >
        <h2 id="unsaved-t">لديك تغييرات غير محفوظة</h2>
        <p id="unsaved-d" className="hint">إن غادرت هذا التبويب الآن فستضيع تعديلاتك. هل تريد حفظها أم تجاهلها؟</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="addrow">
          <button ref={first} type="button" className="btn" disabled={busy} onClick={onSave}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
          <button type="button" className="btn btn--ghost danger" disabled={busy} onClick={onDiscard}>تجاهل</button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>البقاء هنا</button>
        </div>
      </div>
    </div>
  );
}
