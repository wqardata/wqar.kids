"use client";
import { createContext, useContext, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { OWNER_LABELS, SECTION_BY_ID, type Arrangement, type OwnerId, type TabId } from "@/lib/adminSections";

/**
 * آلية نقل الأقسام: المكوّن المالك (مثل SettingsTab) يبقى مركّبًا بحالته وزر حفظه، لكن واجهته لا تُرسم في مكانه؛
 * كل <MovableSection> يرسم محتواه (عبر portal) داخل حاوية التبويب المعروض إن كان قسمه معيّنًا لهذا التبويب.
 * فالنقل يغيّر مكان العرض فقط ولا يمسّ منطق الحفظ.
 */
export type HostValue = { el: HTMLElement | null; tab: TabId; arrangement: Arrangement };
export const HostCtx = createContext<HostValue | null>(null);
export const OwnerCtx = createContext<{ owner: OwnerId; formId: string; home: TabId } | null>(null);

/** يجعل Enter وزر submit يعملان رغم أن الحقول صارت خارج وسم <form> مالكها. */
function formProxy(formId: string | undefined) {
  const form = () => (formId ? (document.getElementById(formId) as HTMLFormElement | null) : null);
  return {
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      const t = e.target;
      if (e.key !== "Enter" || e.defaultPrevented || !(t instanceof HTMLInputElement) || t.form) return;
      if (["button", "submit", "checkbox", "radio", "file", "range", "color", "reset"].includes(t.type)) return;
      const f = form();
      if (f) {
        e.preventDefault();
        f.requestSubmit();
      }
    },
    onClick(e: MouseEvent<HTMLElement>) {
      const b = (e.target as HTMLElement).closest?.('button[type="submit"]') as HTMLButtonElement | null;
      if (!b || b.form) return;
      const f = form();
      if (f) {
        e.preventDefault();
        f.requestSubmit();
      }
    },
  };
}

export function MovableSection({ id, children }: { id: string; children: ReactNode }) {
  const host = useContext(HostCtx);
  const owner = useContext(OwnerCtx);
  if (!host?.el) return null;
  const i = (host.arrangement[host.tab] ?? []).indexOf(id);
  if (i < 0) return null;
  return createPortal(
    <div className="msec" data-section={id} style={{ order: i * 2 }} {...formProxy(owner?.formId)}>
      {children}
    </div>,
    host.el,
  );
}

/** ما يلي الأقسام من رسائل وأزرار حفظ ونوافذ: يُعرض بعد آخر قسم لهذا المالك في التبويب المعروض. */
export function OwnerFooter({ children }: { children: ReactNode }) {
  const host = useContext(HostCtx);
  const owner = useContext(OwnerCtx);
  if (!host?.el || !owner) return null;
  const list = host.arrangement[host.tab] ?? [];
  let last = -1;
  list.forEach((sid, i) => {
    if (SECTION_BY_ID[sid]?.owner === owner.owner) last = i;
  });
  if (last < 0) return null;
  return createPortal(
    <div className="msec msec-foot" style={{ order: last * 2 + 1 }} {...formProxy(owner.formId)}>
      {owner.home !== host.tab && <p className="hint msec-from">حفظ «{OWNER_LABELS[owner.owner]}»</p>}
      {children}
    </div>,
    host.el,
  );
}

/** بديل <form>: وسم فارغ يحمل المعرّف وأحداث الإرسال، بينما حقوله تُرسم في حاوية التبويب. */
export function OwnerForm({ onSubmit, children }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void; children: ReactNode }) {
  const owner = useContext(OwnerCtx);
  return (
    <form id={owner?.formId} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
