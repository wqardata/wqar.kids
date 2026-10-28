"use client";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_STRUCTURE,
  MAX_LABEL,
  OWNER_ONLY_TABS,
  SECTION_BY_ID,
  UNSORTED_GROUP,
  UNSORTED_LABEL,
  UNSORTED_TAB,
  cloneStructure,
  defaultArrangement,
  newId,
  sameArrangement,
  sameStructure,
  tabOf,
  type Arrangement,
  type Structure,
  type TabId,
} from "@/lib/adminSections";
import type { AdminLayout } from "@/lib/adminLayoutStore";
import { useSaveRegistration } from "./saveKit";

const NEW_GROUP = "__new";

const tidyLabel = (v: string) => v.replace(/\s+/g, " ").trim();

function tidyStructure(s: Structure): Structure {
  return {
    groups: s.groups.map((g) => (g.id === UNSORTED_GROUP ? g : { ...g, label: tidyLabel(g.label) })),
    tabs: s.tabs.map((t) => (t.id === UNSORTED_TAB ? t : { ...t, label: tidyLabel(t.label) })),
  };
}

/** يرجع نص المشكلة إن وُجدت (اسم فارغ أو محجوز)، وإلا سلسلة فارغة. */
function problemOf(s: Structure): string {
  for (const x of [...s.groups.filter((g) => g.id !== UNSORTED_GROUP), ...s.tabs.filter((t) => t.id !== UNSORTED_TAB)]) {
    const l = tidyLabel(x.label);
    if (!l) return "اسم التبويب لا يمكن أن يكون فارغًا.";
    if (l === UNSORTED_LABEL) return `الاسم «${UNSORTED_LABEL}» محجوز للتبويب التلقائي، اختر اسمًا آخر.`;
  }
  return "";
}

/** يحذف تبويبات من البنية وينقل مربعاتها إلى «غير منظم»؛ وتسقط أي مجموعة فرغت من تبويباتها. */
function removeTabs(d: AdminLayout, ids: TabId[], isOwner: boolean): { next: AdminLayout; moved: number } {
  const arrangement: Arrangement = { ...d.arrangement };
  let movedIds: string[] = [];
  for (const id of ids) {
    movedIds = movedIds.concat(arrangement[id] ?? []);
    delete arrangement[id];
  }
  arrangement[UNSORTED_TAB] = [...(arrangement[UNSORTED_TAB] ?? []), ...movedIds];
  const tabs = d.structure.tabs.filter((t) => !ids.includes(t.id));
  const groups = d.structure.groups.filter((g) => g.id === UNSORTED_GROUP || tabs.some((t) => t.group === g.id));
  const moved = movedIds.filter((id) => isOwner || !SECTION_BY_ID[id]?.ownerOnly).length;
  return { next: { arrangement, structure: { groups, tabs } }, moved };
}

/**
 * تبويب الترس: ينقل أي قسم إعدادات إلى أي تبويب آخر أو يغيّر مكانه، ويضيف تبويبات ويعيد تسميتها ويحذفها.
 * ما كان في تبويب محذوف ينتقل تلقائيًا إلى تبويب «غير منظم».
 * التعديلات مسودة حتى تضغط «حفظ التغييرات»، ثم تُطبَّق على كل المشرفين.
 */
export default function LayoutEditor({
  view,
  structure,
  arrangement,
  isOwner,
  onSave,
}: {
  /** "tabs" = أسماء التبويبات (إضافة/إعادة تسمية/حذف)، "arrange" = نقل المربعات بين التبويبات. المسودة مشتركة بينهما. */
  view: "tabs" | "arrange";
  structure: Structure;
  arrangement: Arrangement;
  isOwner: boolean;
  onSave: (l: AdminLayout) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AdminLayout>({ arrangement, structure });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState(NEW_GROUP);
  const dirty = !sameArrangement(draft.arrangement, arrangement) || !sameStructure(draft.structure, structure);

  // وصل التخطيط المحفوظ من الخادم ولا تعديلات معلّقة: نعرضه.
  useEffect(() => {
    if (!dirty) setDraft({ arrangement, structure });
  }, [arrangement, structure]); // eslint-disable-line react-hooks/exhaustive-deps

  const arr = draft.arrangement;
  const groups = draft.structure.groups;
  const visibleTabs = draft.structure.tabs.filter((t) => isOwner || !t.ownerOnly);
  const targets = visibleTabs.filter((t) => !OWNER_ONLY_TABS.includes(t.id));
  const groupLabel = (gid: string) => groups.find((g) => g.id === gid)?.label ?? "";
  const labelOf = (id: TabId) => draft.structure.tabs.find((t) => t.id === id)?.label ?? id;
  const homeLabelOf = (home: TabId) => {
    const h = draft.structure.tabs.find((x) => x.id === home);
    return h ? `من «${h.label}»` : "من تبويب محذوف";
  };
  const dupLabels = new Set(targets.map((t) => t.label).filter((l, i, all) => all.indexOf(l) !== i));
  const optionLabel = (t: { label: string; group: string }) => (dupLabels.has(t.label) ? `${t.label} (${groupLabel(t.group)})` : t.label);
  const editableGroups = groups.filter((g) => g.id !== UNSORTED_GROUP && visibleTabs.some((t) => t.group === g.id));

  const touch = () => {
    setMsg("");
    setError("");
  };
  const note = (text: string) => {
    setError("");
    setMsg(text);
  };

  const swap = (tab: TabId, i: number, dir: -1 | 1) => {
    touch();
    const list = [...(arr[tab] ?? [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setDraft({ ...draft, arrangement: { ...arr, [tab]: list } });
  };
  const moveTo = (id: string, to: TabId) => {
    touch();
    const from = tabOf(arr, id);
    if (!from || from === to) return;
    setDraft({ ...draft, arrangement: { ...arr, [from]: arr[from].filter((x) => x !== id), [to]: [...(arr[to] ?? []), id] } });
  };

  // السحب والإفلات: يعيد ترتيب المربعات داخل البطاقة أو ينقلها إلى بطاقة أخرى. before = المربع الذي يُدرَج قبله (null = في آخر البطاقة).
  const dragRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ tab: TabId; before: string | null } | null>(null);
  const endDrag = () => {
    dragRef.current = null;
    setDragId(null);
    setDrop(null);
  };
  const applyDrop = () => {
    const id = dragRef.current;
    const target = drop;
    endDrag();
    if (!id || !target) return;
    const from = tabOf(arr, id);
    if (!from || target.before === id) return;
    touch();
    const next: Arrangement = { ...arr, [from]: arr[from].filter((x) => x !== id) };
    const base = [...(next[target.tab] ?? [])];
    const at = target.before ? base.indexOf(target.before) : -1;
    if (at < 0) base.push(id);
    else base.splice(at, 0, id);
    next[target.tab] = base;
    if (sameArrangement(next, arr)) return;
    setDraft({ ...draft, arrangement: next });
  };

  const addTab = () => {
    const name = tidyLabel(newName);
    if (!name) {
      setMsg("");
      setError("اكتب اسم التبويب أولًا.");
      return;
    }
    if (name === UNSORTED_LABEL) {
      setMsg("");
      setError(`الاسم «${UNSORTED_LABEL}» محجوز للتبويب التلقائي، اختر اسمًا آخر.`);
      return;
    }
    const taken = new Set([...groups.map((g) => g.id), ...draft.structure.tabs.map((t) => t.id)]);
    const tid = newId("t", taken);
    const unsortedG = groups.filter((g) => g.id === UNSORTED_GROUP);
    const unsortedT = draft.structure.tabs.filter((t) => t.id === UNSORTED_TAB);
    let nextGroups = groups;
    let gid = newGroup;
    if (newGroup === NEW_GROUP || !groups.some((g) => g.id === newGroup)) {
      gid = newId("g", taken);
      nextGroups = [...groups.filter((g) => g.id !== UNSORTED_GROUP), { id: gid, label: name }, ...unsortedG];
    }
    const nextTabs = [...draft.structure.tabs.filter((t) => t.id !== UNSORTED_TAB), { id: tid, label: name, group: gid }, ...unsortedT];
    setDraft({ arrangement: { ...arr, [tid]: [] }, structure: { groups: nextGroups, tabs: nextTabs } });
    setNewName("");
    note(`أُضيف التبويب «${name}». انقل إليه مربعات من تبويب «تنظيم»، ثم اضغط «حفظ التغييرات».`);
  };

  const renameGroup = (id: string, label: string) => {
    touch();
    setDraft({ ...draft, structure: { ...draft.structure, groups: groups.map((g) => (g.id === id ? { ...g, label } : g)) } });
  };
  const renameTab = (id: string, label: string) => {
    touch();
    setDraft({ ...draft, structure: { ...draft.structure, tabs: draft.structure.tabs.map((t) => (t.id === id ? { ...t, label } : t)) } });
  };

  const afterDelete = (name: string, moved: number) =>
    note(moved > 0 ? `حُذف «${name}» ونُقلت ${moved} من مربعاته تلقائيًا إلى «${UNSORTED_LABEL}».` : `حُذف «${name}».`);
  const deleteTab = (id: TabId) => {
    const { next, moved } = removeTabs(draft, [id], isOwner);
    const name = labelOf(id);
    setDraft(next);
    afterDelete(name, moved);
  };
  const deleteGroup = (gid: string) => {
    const ids = draft.structure.tabs.filter((t) => t.group === gid).map((t) => t.id);
    const { next, moved } = removeTabs(draft, ids, isOwner);
    const name = groupLabel(gid);
    setDraft(next);
    afterDelete(name, moved);
  };

  const resetDefault = () => {
    touch();
    setDraft({ arrangement: defaultArrangement(), structure: cloneStructure(DEFAULT_STRUCTURE) });
  };
  const isDefault = sameArrangement(draft.arrangement, defaultArrangement()) && sameStructure(draft.structure, DEFAULT_STRUCTURE);

  async function save(): Promise<boolean> {
    const problem = problemOf(draft.structure);
    if (problem) {
      setMsg("");
      setError(problem);
      return false;
    }
    const tidy: AdminLayout = { arrangement: draft.arrangement, structure: tidyStructure(draft.structure) };
    setBusy(true);
    touch();
    try {
      await onSave(tidy);
      setDraft(tidy);
      setMsg("تم حفظ الترتيب ✓ — يظهر لكل المشرفين.");
      return true;
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // الحفظ والعودة للافتراضي من شريط الحفظ الموحّد أعلى التبويب؛ الخطأ يُمرَّر إليه كي يظهر أيضًا في نافذة «حفظ / تجاهل».
  useSaveRegistration({ dirty, isDefault, error, busy, save, reset: resetDefault });

  return (
    <div className="layout-ed">
      <section className="panel panel--wide">
        <h2>تخصيص اللوحة</h2>
        {view === "arrange" ? (
          <p className="hint">
            اسحب أي مربع إعدادات وأفلته في أي تبويب أو في مكان آخر داخل تبويبه، أو استعمل السهمين وقائمة «نقل إلى». يبقى المربع محتفظًا بإعداداته كما هي؛ يتغيّر مكان ظهوره فقط.
            المربع المنقول يُحفظ مع باقي التبويب من زر «حفظ التغييرات» في أعلاه.
          </p>
        ) : (
          <p className="hint">عدّل أسماء التبويبات أو أضف تبويبات أو احذفها، ثم اضغط «حفظ التغييرات». تبقى التعديلات مسودة عند التنقل بين «التبويبات» و«تنظيم».</p>
        )}
        {msg && <p className="hint" role="status">{msg}</p>}
      </section>

      {view === "tabs" && (
      <section className="panel panel--wide tabs-mgr" aria-labelledby="tm-title">
        <h2 id="tm-title">إدارة التبويبات</h2>
        <p className="hint">
          أضف تبويبًا جديدًا، أو أعد تسمية أي تبويب، أو احذفه. المربعات التي كانت في تبويب محذوف تنتقل تلقائيًا إلى تبويب «{UNSORTED_LABEL}» فلا يضيع شيء.
          إن كان في التبويب الرئيسي تبويب فرعي واحد فقط فلا يظهر الشريط الفرعي، ويظهر اسم التبويب الرئيسي.
        </p>

        <div className="addrow tm-add">
          <input
            type="text"
            value={newName}
            maxLength={MAX_LABEL}
            placeholder="اسم التبويب الجديد"
            aria-label="اسم التبويب الجديد"
            onChange={(e) => { touch(); setNewName(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTab(); } }}
          />
          <select aria-label="مكان التبويب الجديد" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
            <option value={NEW_GROUP}>تبويب رئيسي جديد</option>
            {editableGroups.map((g) => (
              <option key={g.id} value={g.id}>داخل: {g.label}</option>
            ))}
          </select>
          <button type="button" className="btn" disabled={busy} onClick={addTab}>＋ إضافة تبويب</button>
        </div>

        <div className="tm-list">
          {editableGroups.map((g) => {
            const subs = visibleTabs.filter((t) => t.group === g.id);
            const lockedForAdmin = !isOwner && draft.structure.tabs.some((t) => t.group === g.id && t.ownerOnly);
            return (
              <div key={g.id} className="tm-group">
                <div className="tm-row tm-row--group">
                  <span className="tm-kind">رئيسي</span>
                  <input
                    type="text"
                    value={g.label}
                    maxLength={MAX_LABEL}
                    aria-label={`اسم التبويب الرئيسي «${g.label}»`}
                    onChange={(e) => renameGroup(g.id, e.target.value)}
                  />
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy || lockedForAdmin} aria-label={`حذف التبويب الرئيسي «${g.label}» بكل تبويباته`} onClick={() => deleteGroup(g.id)}>
                    حذف
                  </button>
                </div>
                {subs.map((t) => (
                  <div key={t.id} className="tm-row tm-row--tab">
                    <span className="tm-kind">فرعي</span>
                    <input
                      type="text"
                      value={t.label}
                      maxLength={MAX_LABEL}
                      aria-label={`اسم التبويب الفرعي «${t.label}»`}
                      onChange={(e) => renameTab(t.id, e.target.value)}
                    />
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy} aria-label={`حذف التبويب «${t.label}»`} onClick={() => deleteTab(t.id)}>
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
          <p className="hint tm-sys">«{UNSORTED_LABEL}»: تبويب تلقائي يستقبل مربعات التبويبات المحذوفة، ويظهر في اللوحة ما دام فيه مربعات. لا يُحذف ولا يُعاد تسميته.</p>
        </div>
      </section>
      )}

      {view === "arrange" && (() => {
        const cards = visibleTabs.filter((t) => {
          if (t.id !== UNSORTED_TAB) return true;
          const n = (arr[t.id] ?? []).filter((id) => isOwner || !SECTION_BY_ID[id]?.ownerOnly).length;
          return n > 0 || dragId !== null;
        });
        const half = Math.ceil(cards.length / 2);

        const renderCard = (t: (typeof cards)[number]) => {
          const full = arr[t.id] ?? [];
          const list = full.filter((id) => isOwner || !SECTION_BY_ID[id]?.ownerOnly);
          const over = drop?.tab === t.id;
          return (
            <section
              key={t.id}
              className={over ? "panel layout-tab layout-tab--over" : "panel layout-tab"}
              aria-labelledby={`lt-${t.id}`}
              onDragOver={(e) => {
                if (!dragRef.current) return;
                e.preventDefault();
                if (!(drop?.tab === t.id && drop.before === null)) setDrop({ tab: t.id, before: null });
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop((d) => (d?.tab === t.id ? null : d));
              }}
              onDrop={(e) => {
                e.preventDefault();
                applyDrop();
              }}
            >
              <h3 id={`lt-${t.id}`}>
                {t.label} {t.id !== UNSORTED_TAB && <small>{groupLabel(t.group)}</small>}
              </h3>
              {list.length === 0 ? (
                <p className={over ? "empty-note layout-empty layout-empty--over" : "empty-note layout-empty"}>
                  {dragId ? "أفلت هنا لنقل المربع إلى هذا التبويب." : "لا توجد مربعات في هذا التبويب. انقل إليه من تبويب آخر."}
                </p>
              ) : (
                <ol className={over && drop?.before === null ? "layout-list layout-list--end" : "layout-list"}>
                  {list.map((id, i) => {
                    const def = SECTION_BY_ID[id];
                    if (!def) return null;
                    const at = full.indexOf(id);
                    const cls = ["layout-row"];
                    if (dragId === id) cls.push("layout-row--drag");
                    if (over && drop?.before === id && dragId !== id) cls.push("layout-row--before");
                    return (
                      <li
                        key={id}
                        className={cls.join(" ")}
                        draggable
                        onDragStart={(e) => {
                          dragRef.current = id;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", id);
                          // بعد بدء السحب فعلًا، كي لا يُلغيه تغيّر الشكل.
                          setTimeout(() => setDragId(id), 0);
                        }}
                        onDragEnd={endDrag}
                        onDragOver={(e) => {
                          if (!dragRef.current) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          const before = e.clientY < r.top + r.height / 2 ? id : (list[i + 1] ?? null);
                          if (!(drop?.tab === t.id && drop.before === before)) setDrop({ tab: t.id, before });
                        }}
                      >
                        <div className="layout-name">
                          <span><i className="layout-grip" aria-hidden="true">⠿</i> {def.label}</span>
                          {def.home !== t.id && <small>{homeLabelOf(def.home)}</small>}
                        </div>
                        <div className="layout-ctl">
                          <button type="button" className="btn btn--ghost btn--sm" aria-label={`رفع «${def.label}»`} disabled={i === 0} onClick={() => swap(t.id, at, -1)}>▲</button>
                          <button type="button" className="btn btn--ghost btn--sm" aria-label={`خفض «${def.label}»`} disabled={i === list.length - 1} onClick={() => swap(t.id, at, 1)}>▼</button>
                          <select aria-label={`نقل «${def.label}» إلى تبويب`} value={t.id} onChange={(e) => moveTo(id, e.target.value as TabId)}>
                            {!targets.some((x) => x.id === t.id) && <option value={t.id}>{t.label}</option>}
                            {targets.map((x) => (
                              <option key={x.id} value={x.id}>{x.id === t.id ? `هنا: ${optionLabel(x)}` : `نقل إلى: ${optionLabel(x)}`}</option>
                            ))}
                          </select>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        };

        return (
          <div className="layout-cols">
            <div className="layout-col">{cards.slice(0, half).map(renderCard)}</div>
            <div className="layout-col">{cards.slice(half).map(renderCard)}</div>
          </div>
        );
      })()}
    </div>
  );
}
