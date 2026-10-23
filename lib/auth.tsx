"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
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
  /** هل للحساب كلمة مرور (تسجيل بالبريد)؟ حسابات جوجل فقط لا كلمة مرور لها. */
  hasPassword: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveAccount: (patch: { name?: string; avatar?: string }) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

// يمنع إنشاء سجل العضو مرتين متزامنتين (عند التسجيل يُستدعى من مكانين).
const inflight = new Map<string, Promise<void>>();

/** ينشئ سجل العضو عند أول دخول (دور «مشاهد» وصورة رمزية افتراضية = أيقونة شخص)، أو يحدّث آخر دخول. */
function ensureProfile(u: User): Promise<void> {
  const running = inflight.get(u.uid);
  if (running) return running;
  const p = (async () => {
    const ref = doc(getDb(), "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
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
  })().finally(() => {
    setTimeout(() => inflight.delete(u.uid), 5000);
  });
  inflight.set(u.uid, p);
  return p;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [banned, setBanned] = useState(false);

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
    void ensureProfile(user).catch(() => {});
    return onSnapshot(
      doc(getDb(), "users", uid),
      (snap) => {
        setProfileLoading(false);
        if (!snap.exists()) {
          setProfile(null);
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
      configured: isFirebaseConfigured,
      // الإدارة تتطلب بريدًا موثّقًا (حساب جوجل موثّق تلقائيًا) — تمامًا كما في firestore.rules.
      canAdd: !banned && verified && (canAddVideos(user?.email) || profile?.role === "admin"),
      isOwner: owner,
      banned,
      hasPassword: Boolean(user?.providerData.some((p) => p.providerId === "password")),
      signIn: async () => {
        setBanned(false);
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
        await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      },
      signUpEmail: async (name, email, password) => {
        setBanned(false);
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
        const clean = name.trim().slice(0, 60);
        if (clean) await updateProfile(cred.user, { displayName: clean }).catch(() => {});
        await sendEmailVerification(cred.user).catch(() => {});
        // يضمن وجود السجل ثم يكتب الاسم فيه (قد يكون السجل أُنشئ قبل ضبط الاسم).
        await ensureProfile(cred.user).catch(() => {});
        if (clean) await updateDoc(doc(getDb(), "users", cred.user.uid), { name: clean }).catch(() => {});
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
  }, [user, profile, authLoading, profileLoading, banned]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
