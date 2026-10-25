import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// يجب كتابة متغيرات NEXT_PUBLIC_* بالاسم الكامل ليستبدلها Next وقت البناء.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export function getFirebaseAuth(): Auth {
  return getAuth(app());
}

export function getDb(): Firestore {
  return getFirestore(app());
}

const admins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** هل يحق لهذا البريد إضافة فيديوهات؟ (التحقق الحقيقي في firestore.rules وفي الـ API) */
export function canAddVideos(email?: string | null): boolean {
  if (!email) return false;
  return admins.length === 0 || admins.includes(email.toLowerCase());
}

/** هل البريد من «المالكين» في NEXT_PUBLIC_ADMIN_EMAILS؟ (صارم: قائمة فارغة = لا أحد). هم وحدهم يديرون الأعضاء. */
export function isOwnerEmail(email?: string | null): boolean {
  return Boolean(email) && admins.includes((email as string).toLowerCase());
}
