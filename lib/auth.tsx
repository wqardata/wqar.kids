"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { canAddVideos, getFirebaseAuth, isFirebaseConfigured } from "./firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  canAdd: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // يُكمل الدخول إن كان المستخدم عائدًا من صفحة جوجل (بديل النافذة المنبثقة).
    getRedirectResult(getFirebaseAuth()).catch(() => {});
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      // الإدارة تتطلب بريدًا موثّقًا (حساب جوجل موثّق تلقائيًا) — تمامًا كما في firestore.rules.
      canAdd: canAddVideos(user?.email) && user?.emailVerified === true,
      signIn: async () => {
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
        await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      },
      signUpEmail: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim().slice(0, 60) }).catch(() => {});
        await sendEmailVerification(cred.user).catch(() => {});
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      },
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
