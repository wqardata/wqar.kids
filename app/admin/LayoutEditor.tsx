"use client";
import { useEffect, useState } from "react";
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
 * التعديلات مسودة حتى تضغط «حفظ الترتيب»، ثم تُطبَّق على كل المشرفين.
 */
export default function LayoutEditor({
  structure,
  arrangement,
  isOwner,
  onSave,
}: {
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
    note(`أُضيف التبويب «${name}». انقل إليه مربعات من القوائم أدناه، ثم اضغط «حفظ الترتيب».`);
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

  async function save() {
    const problem = problemOf(draft.structure);
    if (problem) {
      setMsg("");
      setError(problem);
      return;
    }
    const tidy: AdminLayout = { arrangement: draft.arrangement, structure: tidyStructure(draft.structure) };
    setBusy(true);
    touch();
    try {
      await onSave(tidy);
      setDraft(tidy);
      setMsg("تم حفظ الترتيب ✓ — يظهر لكل المشرفين.");
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout-ed">
      <section className="panel panel--wide">
        <h2>تخصيص اللوحة</h2>
        <p className="hint">
          انقل أي مربع إعدادات إلى تبويب آخر من القائمة بجانبه، أو غيّر مكانه داخل تبويبه بالسهمين. يبقى المربع محتفظًا بحفظه كما هو؛ يتغيّر مكان ظهوره فقط.
          عند نقل مربع من تبويب آخر يظهر معه زر حفظ ذلك التبويب أسفل مربعاته.
        </p>
        {error && <p className="field-error" role="alert">{error}</p>}
        {msg && <p className="hint" role="status">{msg}</p>}
        <div className="addrow">
          <button type="button" className="btn" disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? "جارٍ الحفظ…" : "حفظ الترتيب"}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy || !dirty} onClick={() => { touch(); setDraft({ arrangement, structure }); }}>
            تراجع عن التعديلات
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy || isDefault} onClick={resetDefault}>
            الترتيب الافتراضي
          </button>
          {dirty && <span className="dirty-dot">● تعديلات غير محفوظة</span>}
        </div>
      </section>

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

      <div className="layout-grid">
        {visibleTabs.map((t) => {
          const full = arr[t.id] ?? [];
          const list = full.filter((id) => isOwner || !SECTION_BY_ID[id]?.ownerOnly);
          if (t.id === UNSORTED_TAB && list.length === 0) return null;
          return (
            <section key={t.id} className="panel layout-tab" aria-labelledby={`lt-${t.id}`}>
              <h3 id={`lt-${t.id}`}>
                {t.label} {t.id !== UNSORTED_TAB && <small>{groupLabel(t.group)}</small>}
              </h3>
              {list.length === 0 ? (
                <p className="empty-note">لا توجد مربعات في هذا التبويب. انقل إليه من تبويب آخر.</p>
              ) : (
                <ol className="layout-list">
                  {list.map((id, i) => {
                    const def = SECTION_BY_ID[id];
                    if (!def) return null;
                    const at = full.indexOf(id);
                    return (
                      <li key={id} className="layout-row">
                        <div className="layout-name">
                          <span>{def.label}</span>
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
        })}
      </div>
    </div>
  );
}
