"use client";
import { useCallback, useEffect, useState } from "react";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import {
  DEFAULT_STRUCTURE,
  cloneStructure,
  defaultArrangement,
  reconcileArrangement,
  reconcileStructure,
  type Arrangement,
  type Structure,
} from "./adminSections";

/** ترتيب المربعات + بنية التبويبات (الأسماء والإضافة والحذف) كوحدة واحدة. */
export type AdminLayout = { arrangement: Arrangement; structure: Structure };

const CACHE_KEY = "admin-layout-v2";
const OLD_CACHE_KEY = "admin-layout"; // النسخة السابقة: ترتيب فقط

function build(rawArrangement: unknown, rawStructure: unknown): AdminLayout {
  const structure = reconcileStructure(rawStructure);
  return { structure, arrangement: reconcileArrangement(rawArrangement, structure) };
}

function defaults(): AdminLayout {
  return { structure: cloneStructure(DEFAULT_STRUCTURE), arrangement: defaultArrangement() };
}

function readCache(): AdminLayout {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return build(j?.a, j?.s);
    }
    const old = localStorage.getItem(OLD_CACHE_KEY);
    if (old) return build(JSON.parse(old), null);
  } catch {
    /* لا بأس */
  }
  return defaults();
}

function writeCache(l: AdminLayout | null) {
  try {
    localStorage.removeItem(OLD_CACHE_KEY);
    if (l) localStorage.setItem(CACHE_KEY, JSON.stringify({ a: l.arrangement, s: l.structure }));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* لا بأس */
  }
}

function parse(v: unknown): unknown {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * تخطيط لوحة التحكم: أي قسم في أي تبويب وبأي ترتيب، وأسماء التبويبات وما أُضيف أو حُذف منها.
 * يُحفظ في settings/adminLayout (json = الترتيب، structure = بنية التبويبات) ويُشارك بين المشرفين،
 * ونسخة محلية تمنع وميض التخطيط الافتراضي عند فتح اللوحة.
 * مستند قديم بلا structure يُقرأ ببنية افتراضية فلا يضيع شيء.
 */
export function useAdminArrangement() {
  const [layout, setLayout] = useState<AdminLayout>(() => (typeof window === "undefined" ? defaults() : readCache()));

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDoc(doc(getDb(), "settings", "adminLayout"))
      .then((snap) => {
        if (off) return;
        if (!snap.exists()) {
          writeCache(null);
          setLayout(defaults());
          return;
        }
        const data = snap.data();
        const l = build(parse(data.json), parse(data.structure));
        writeCache(l);
        setLayout(l);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  const save = useCallback(async (next: AdminLayout) => {
    const clean = build(next.arrangement, next.structure);
    await setDoc(doc(getDb(), "settings", "adminLayout"), {
      json: JSON.stringify(clean.arrangement),
      structure: JSON.stringify(clean.structure),
      updatedAt: serverTimestamp(),
    });
    writeCache(clean);
    setLayout(clean);
  }, []);

  const reset = useCallback(async () => {
    await deleteDoc(doc(getDb(), "settings", "adminLayout"));
    writeCache(null);
    setLayout(defaults());
  }, []);

  return { arrangement: layout.arrangement, structure: layout.structure, save, reset };
}
