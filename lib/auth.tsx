"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updatePassword,
  updateProfile,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { DEFAULT_AVATAR, isAvatarId } from "./avatars";
import { canAddVideos, getDb, getFirebaseAuth, isFirebaseConfigured, isOwnerEmail } from "./firebase";
import { toProfile, type Profile } from "./members";

type AuthState = {
  user: User | null;
  /** سجل العضو في Firestore (الدور والصورة الرمزية…)؛ null قبل تحميله. */
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  /** مشرف: يدخل لوحة التحكم ويدير المحتوى (مالك من ADMIN_EMAILS أو دور «مشرف»). */
  canAdd: boolean;
  /** مالك: يدير الأعضاء وصلاحياتهم (البريد ضمن NEXT_PUBLIC_ADMIN_EMAILS). */
  isOwner: boolean;
  /** صار الحساب محظورًا فخرج منه الموقع تلقائيًا. */
  banned: boolean;
  /** حاول الدخول بريدٌ غير مُضاف من الإدارة (التسجيل الذاتي مُغلق) فأُخرج. */
  denied: boolean;
  /** هل للحساب كلمة مرور (تسجيل بالبريد)؟ حسابات جوجل فقط لا كلمة مرور لها. */
  hasPassword: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveAccount: (patch: { name?: string; avatar?: string }) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

// يمنع إنشاء سجل العضو مرتين متزامنتين (عند التسجيل يُستدعى من مكانين).
// الفشل لا يبقى في الذاكرة: كان فشل المحاولة الأولى (مثلًا لحظة إنشاء الحساب) يُخزَّن 5 ثوانٍ فتفشل المحاولة الثانية معه بلا إعادة،
// فيُنشأ الحساب في Firebase Authentication دون سجل عضو في Firestore.
const inflight = new Map<string, Promise<void>>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createOrTouch(u: User): Promise<void> {
  const ref = doc(getDb(), "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // التسجيل الذاتي مُغلق: يُنشأ سجل العضو فقط لمالك الموقع أو لبريد أضافه المالك إلى «allowed».
    const email = (u.email ?? "").toLowerCase();
    if (!isOwnerEmail(email)) {
      let ok = false;
      try {
        ok = (await getDoc(doc(getDb(), "allowed", email))).exists();
      } catch {
        ok = false;
      }
      if (!ok) throw Object.assign(new Error("not-allowed"), { code: "app/not-allowed" });
    }
    await setDoc(ref, {
      email: (u.email ?? "").toLowerCase(),
      name: (u.displayName ?? "").trim().slice(0, 60),
      avatar: DEFAULT_AVATAR,
      role: "viewer",
      banned: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, { lastLoginAt: serverTimestamp(), email: (u.email ?? "").toLowerCase() });
  }
}

/** ينشئ سجل العضو عند أول دخول (دور «مشاهد» وصورة رمزية افتراضية = أيقونة شخص)، أو يحدّث آخر دخول. يعيد المحاولة 3 مرات. */
function ensureProfile(u: User): Promise<void> {
  const running = inflight.get(u.uid);
  if (running) return running;
  const p = (async () => {
    await u.getIdToken().catch(() => ""); // يتأكد أن رمز الدخول جاهز قبل أول كتابة في Firestore
    let last: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        await createOrTouch(u);
        return;
      } catch (e) {
        if ((e as { code?: string }).code === "app/not-allowed") throw e; // لا فائدة من إعادة المحاولة
        last = e;
        await sleep(500 * (i + 1));
      }
    }
    throw last;
  })();
  inflight.set(u.uid, p);
  p.then(
    () => void setTimeout(() => inflight.delete(u.uid), 5000),
    () => void inflight.delete(u.uid),
  );
  return p;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [banned, setBanned] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // يُكمل الدخول إن كان المستخدم عائدًا من صفحة جوجل (بديل النافذة المنبثقة).
    getRedirectResult(getFirebaseAuth()).catch(() => {});
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // سجل العضو: إنشاؤه/تحديثه ثم الاشتراك فيه (الدور والحظر والصورة الرمزية).
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!uid || !user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    // بريد غير مُضاف: نحذف الحساب الذي أنشأه جوجل/المتصفح للتو (إن أمكن) ونُخرجه.
    const onEnsureError = (e: unknown) => {
      if ((e as { code?: string }).code !== "app/not-allowed") return;
      setDenied(true);
      void user.delete().catch(() => {}).finally(() => void fbSignOut(getFirebaseAuth()));
    };
    void ensureProfile(user).catch(onEnsureError);
    return onSnapshot(
      doc(getDb(), "users", uid),
      (snap) => {
        setProfileLoading(false);
        if (!snap.exists()) {
          setProfile(null);
          void ensureProfile(user).catch(onEnsureError); // السجل غائب (فشل إنشاؤه سابقًا): نحاول مرة أخرى
          return;
        }
        const p = toProfile(snap.id, snap.data());
        setProfile(p);
        if (p.banned) {
          setBanned(true);
          void fbSignOut(getFirebaseAuth());
        }
      },
      () => setProfileLoading(false), // القواعد لم تُحدَّث بعد: يعمل الموقع بدور «مشاهد»
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const value = useMemo<AuthState>(() => {
    const verified = user?.emailVerified === true;
    const owner = verified && isOwnerEmail(user?.email);
    return {
      user,
      profile,
      loading: authLoading || profileLoading,
      denied,
      configured: isFirebaseConfigured,
      // الإدارة تتطلب بريدًا موثّقًا (حساب جوجل موثّق تلقائيًا) — تمامًا كما في firestore.rules.
      canAdd: !banned && verified && (canAddVideos(user?.email) || profile?.role === "admin"),
      isOwner: owner,
      banned,
      hasPassword: Boolean(user?.providerData.some((p) => p.providerId === "password")),
      signIn: async () => {
        setBanned(false);
        setDenied(false);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const auth = getFirebaseAuth();
        try {
          await signInWithPopup(auth, provider);
        } catch (e) {
          const code = (e as { code?: string }).code;
          // المتصفح حجب النافذة أو لا يدعمها: ننتقل لصفحة جوجل بدل أن يفشل الدخول.
          if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
            await signInWithRedirect(auth, provider);
            return;
          }
          throw e;
        }
      },
      signOut: async () => {
        await fbSignOut(getFirebaseAuth());
      },
      signInEmail: async (email, password) => {
        setBanned(false);
        setDenied(false);
        await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      },
      saveAccount: async (patch) => {
        const u = getFirebaseAuth().currentUser;
        if (!u) throw new Error("not-signed-in");
        const data: Record<string, string> = {};
        if (typeof patch.name === "string") data.name = patch.name.trim().slice(0, 60);
        if (patch.avatar !== undefined) {
          if (!isAvatarId(patch.avatar)) throw new Error("bad-avatar");
          data.avatar = patch.avatar;
        }
        await updateDoc(doc(getDb(), "users", u.uid), data);
        if (data.name !== undefined) await updateProfile(u, { displayName: data.name }).catch(() => {});
      },
      changePassword: async (current, next) => {
        const u = getFirebaseAuth().currentUser;
        if (!u?.email) throw new Error("not-signed-in");
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
        await updatePassword(u, next);
      },
    };
  }, [user, profile, authLoading, profileLoading, banned, denied]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
