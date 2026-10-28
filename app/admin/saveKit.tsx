"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { OwnerCtx } from "./sectionKit";

/**
 * حفظ موحَّد لتبويبات الإعدادات في لوحة التحكم.
 *
 * كل تبويب (أو مربع له حفظه) يسجّل نفسه بـ useSaveBar: هل فيه تعديلات؟ وكيف يُحفظ؟ وكيف يُتجاهل؟ وكيف يعود للافتراضي؟
 * ثم يعرض <SaveBar> زرّين فقط فوق الإعدادات («حفظ التغييرات» و«العودة إلى الافتراضي») ويحفظ ما سُجِّل كله،
 * ويستعمل AdminPanel نفس السجل لإظهار نافذة «حفظ أم تجاهل» عند مغادرة التبويب وفيه تعديلات.
 */

/** خطأ تحقق: يُعرض نصه كما هو في الشريط. أي خطأ آخر يظهر برسالة «تعذّر الحفظ» العامة. */
export class FormError extends Error {}

const GENERIC_ERROR = "تعذّر الحفظ. تأكد من صلاحياتك واتصالك بالإنترنت ثم أعد المحاولة.";

export type SaveEntry = {
  label: string;
  dirty: boolean;
  busy: boolean;
  /** القيم الحالية في النموذج هي الافتراضية نفسها (فلا حاجة لزر «العودة إلى الافتراضي»). */
  isDefault: boolean;
  message: string;
  error: string;
  save: () => Promise<boolean>;
  discard: () => void;
  reset: () => void;
};

export type SaveStore = {
  set(id: string, e: SaveEntry): void;
  remove(id: string): void;
  entries(): SaveEntry[];
  anyDirty(): boolean;
  /** يحفظ كل ما فيه تعديلات واحدًا بعد الآخر، ويتوقف عند أول فشل. */
  saveAll(): Promise<boolean>;
  discardAll(): void;
  resetAll(): void;
  subscribe(fn: () => void): () => void;
  version(): number;
};

export function createSaveStore(): SaveStore {
  const map = new Map<string, SaveEntry>();
  const subs = new Set<() => void>();
  let ver = 0;
  const emit = () => {
    ver++;
    subs.forEach((f) => f());
  };
  // الدوال تتغيّر في كل رسم؛ نُعلِم المشتركين عند تغيّر ما يُعرض فقط كي لا تتكرر الرسومات بلا نهاية.
  const same = (a: SaveEntry | undefined, b: SaveEntry) =>
    !!a && a.label === b.label && a.dirty === b.dirty && a.busy === b.busy && a.isDefault === b.isDefault && a.message === b.message && a.error === b.error;
  return {
    set(id, e) {
      const prev = map.get(id);
      map.set(id, e);
      if (!same(prev, e)) emit();
    },
    remove(id) {
      if (map.delete(id)) emit();
    },
    entries: () => [...map.values()],
    anyDirty: () => [...map.values()].some((e) => e.dirty),
    async saveAll() {
      const ids = [...map.entries()].filter(([, e]) => e.dirty).map(([id]) => id);
      for (const id of ids) {
        const e = map.get(id);
        if (e && !(await e.save())) return false;
      }
      return true;
    },
    discardAll() {
      for (const e of [...map.values()]) if (e.dirty) e.discard();
    },
    resetAll() {
      for (const e of [...map.values()]) e.reset();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    version: () => ver,
  };
}

export const SaveStoreCtx = createContext<SaveStore | null>(null);

type BarConfig = {
  /** اسم ما يُحفظ (يظهر في الشريط حين تجتمع أكثر من جهة في تبويب واحد، وفي نافذة المغادرة). */
  label: string;
  /** توقيع (JSON) لما في النموذج الآن، ولآخر نسخة محفوظة، وللقيم الافتراضية. اختلاف الأولين = تعديلات غير محفوظة. */
  draftSig: string;
  savedSig: string;
  defaultSig?: string;
  /** يرمي FormError لخطأ تحقق، وأي خطأ آخر لفشل الحفظ. عند النجاح على المالك أن يضبط نموذجه على المحفوظ. */
  onSave: () => Promise<void>;
  /** يُرجع النموذج إلى آخر نسخة محفوظة. */
  onDiscard: () => void;
  /** يضع القيم الافتراضية في النموذج (لا يحفظ؛ الحفظ بزر «حفظ التغييرات»). */
  onReset: () => void;
};

/**
 * يسجّل هذا المربع/التبويب في شريط الحفظ. `key` يميّز أكثر من تسجيل داخل المالك الواحد.
 * يعيد `save` (لإرسال النموذج بـ Enter) و`fail` لعرض خطأ غير ناتج عن الحفظ (رفع صورة فاشل مثلًا) في الشريط.
 */
export function useSaveBar(key: string, cfg: BarConfig) {
  const store = useContext(SaveStoreCtx);
  const owner = useContext(OwnerCtx);
  const id = `${owner?.owner ?? "x"}:${key}`;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const busyRef = useRef(false);
  const dirty = cfg.draftSig !== cfg.savedSig;
  const isDefault = cfg.defaultSig !== undefined && cfg.draftSig === cfg.defaultSig;

  // تغيّر المحفوظ من خارج هذا النموذج (وصول الإعدادات متأخرة، أو حفظ مربع آخر لنفس الحقول) ولا تعديلات للمستخدم: نتبع المحفوظ.
  const prevSaved = useRef(cfg.savedSig);
  useEffect(() => {
    if (prevSaved.current === cfg.savedSig) return;
    if (cfgRef.current.draftSig === prevSaved.current) cfgRef.current.onDiscard();
    prevSaved.current = cfg.savedSig;
  }, [cfg.savedSig]);

  const save = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await cfgRef.current.onSave();
      setMessage("تم الحفظ ✓");
      return true;
    } catch (e) {
      setError(e instanceof FormError ? e.message : GENERIC_ERROR);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // أي تعديل جديد يمسح رسالة «تم الحفظ» وأي خطأ سابق.
  useEffect(() => {
    if (dirty) {
      setMessage("");
      setError("");
    }
  }, [dirty]);

  // يُحدَّث السجل بعد كل رسم ليحمل أحدث الدوال؛ الاشتراك يُبلَّغ فقط عند تغيّر ما يُعرض.
  useEffect(() => {
    store?.set(id, {
      label: cfg.label,
      dirty,
      busy,
      isDefault,
      message,
      error,
      save,
      discard: () => cfgRef.current.onDiscard(),
      reset: () => cfgRef.current.onReset(),
    });
  });
  useEffect(() => () => store?.remove(id), [store, id]);

  const fail = useCallback((msg: string) => {
    setMessage("");
    setError(msg);
  }, []);
  return { save, fail };
}

/** الشريط الموحَّد فوق إعدادات التبويب: حفظ التغييرات + العودة إلى الافتراضي، مع حالة الحفظ. */
export function SaveBar({ store }: { store: SaveStore }) {
  useSyncExternalStore(store.subscribe, store.version, store.version);
  const list = store.entries();
  if (list.length === 0) return null;

  const dirty = list.filter((e) => e.dirty);
  const busy = list.some((e) => e.busy);
  const many = list.length > 1;
  const failed = list.find((e) => e.error);
  const saved = list.find((e) => e.message);
  const allDefault = list.every((e) => e.isDefault);

  const resetAll = () => {
    if (!window.confirm("إرجاع إعدادات هذا التبويب إلى الافتراضي؟ لن يُحفظ شيء حتى تضغط «حفظ التغييرات».")) return;
    store.resetAll();
  };

  return (
    <div className={dirty.length ? "savebar savebar--dirty" : "savebar"} role="region" aria-label="حفظ الإعدادات">
      <div className="savebar-status" aria-live="polite">
        {failed ? (
          <span className="field-error" role="alert">{many && failed.label ? `${failed.label}: ` : ""}{failed.error}</span>
        ) : dirty.length ? (
          <span className="dirty-dot">● تعديلات غير محفوظة{many ? ` (${dirty.map((e) => e.label).join("، ")})` : ""}</span>
        ) : saved ? (
          <span className="hint">{saved.message}</span>
        ) : null}
      </div>
      <div className="savebar-actions">
        <button type="button" className="btn" disabled={busy || dirty.length === 0} onClick={() => void store.saveAll()}>
          {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
        </button>
        <button type="button" className="btn btn--ghost" disabled={busy || allDefault} onClick={resetAll}>
          العودة إلى الافتراضي
        </button>
      </div>
    </div>
  );
}

/** نافذة تظهر عند مغادرة تبويب فيه تعديلات: حفظ ثم المتابعة، أو تجاهلها، أو البقاء (Esc). */
export function UnsavedDialog({
  labels,
  busy,
  error,
  onSave,
  onDiscard,
  onCancel,
}: {
  labels: string[];
  busy: boolean;
  error: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="dlg-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">
        <h2 id="dlg-t">تغييرات غير محفوظة</h2>
        <p id="dlg-d">
          لديك تعديلات لم تُحفظ{labels.length ? ` في: ${labels.join("، ")}` : ""}. هل تريد حفظها قبل المغادرة أم تجاهلها؟
        </p>
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
