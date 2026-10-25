"use client";
// إضافة الأعضاء بيد المالك (التسجيل الذاتي مُغلق): قائمة «المسموح لهم» allowed/{email} + حساب بريد وكلمة مرور اختياري.
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, updateProfile } from "firebase/auth";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { DEFAULT_AVATAR } from "./avatars";
import { getDb, getSecondary } from "./firebase";

export const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

export type AddMemberResult = {
  /** أُنشئ له حساب بريد وكلمة مرور الآن (وإلا يدخل بجوجل أو بحسابه الموجود). */
  createdAccount: boolean;
  /** البريد مرتبط بحساب موجود في Firebase من قبل (أُضيف للقائمة فقط). */
  existed: boolean;
};

/** يضيف البريد إلى القائمة المسموح لها بالدخول، وينشئ حسابًا بكلمة المرور إن أُعطيت. */
export async function addMember(input: { name: string; email: string; password: string }): Promise<AddMemberResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 60);
  if (!EMAIL_RE.test(email)) throw Object.assign(new Error("bad-email"), { code: "app/bad-email" });
  // 1) القائمة أولًا: قواعد Firestore لا تسمح بإنشاء سجل عضو إلا لمن بريده فيها.
  await setDoc(doc(getDb(), "allowed", email), { email, name, createdAt: serverTimestamp() });
  if (!input.password) return { createdAccount: false, existed: false };

  // 2) حساب البريد وكلمة المرور عبر تطبيق ثانوي كي لا تتأثر جلسة المالك.
  const { auth, db } = getSecondary();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, input.password);
    if (name) await updateProfile(cred.user, { displayName: name }).catch(() => {});
    await sendEmailVerification(cred.user).catch(() => {});
    // سجل العضو يُنشأ بصفة صاحب الحساب نفسه (دور مشاهد؛ يغيّره المالك بعد ذلك).
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      name,
      avatar: DEFAULT_AVATAR,
      role: "viewer",
      banned: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    return { createdAccount: true, existed: false };
  } catch (e) {
    if ((e as { code?: string }).code === "auth/email-already-in-use") return { createdAccount: false, existed: true };
    throw e;
  } finally {
    await signOut(auth).catch(() => {});
  }
}

/** يزيل البريد من القائمة (لا يستطيع الدخول بعدها). */
export async function removeAllowed(email: string): Promise<void> {
  await deleteDoc(doc(getDb(), "allowed", email.trim().toLowerCase()));
}
