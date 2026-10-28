import { createRemoteJWKSet, jwtVerify } from "jose";
import { decodeFields } from "./serverSettings";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

/** يتحقق من توكن Firebase ويعيد البريد (بحروف صغيرة) والمعرّف، أو null إن كان غير صالح أو بريده غير موثّق. */
export async function claimsFromToken(token: string): Promise<{ email: string; uid: string } | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !projectId) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"], // توكنات Firebase موقَّعة بـ RS256 فقط
    });
    if (payload.email_verified !== true || typeof payload.email !== "string" || typeof payload.sub !== "string") return null;
    return { email: payload.email.toLowerCase(), uid: payload.sub };
  } catch {
    return null;
  }
}

/** يتحقق من توكن Firebase ويعيد البريد (بحروف صغيرة)، أو null إن كان غير صالح أو بريده غير موثّق. */
export async function emailFromToken(token: string): Promise<string | null> {
  return (await claimsFromToken(token))?.email ?? null;
}

/**
 * هل صاحب التوكن مشرف؟ إما بريده في ADMIN_EMAILS، أو دوره «admin» وغير محظور في users/{uid}.
 * سجل العضو يُقرأ بتوكن العضو نفسه، فتطبّق قواعد Firestore (القراءة الذاتية مسموحة) ولا نحتاج مفتاح خدمة.
 */
export async function adminFromToken(token: string): Promise<{ email: string } | { error: "unauthorized" | "forbidden" }> {
  const c = await claimsFromToken(token);
  if (!c) return { error: "unauthorized" };
  if (isAdminEmail(c.email)) return { email: c.email };
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!pid) return { error: "forbidden" };
  try {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/users/${encodeURIComponent(c.uid)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return { error: "forbidden" };
    const j = (await r.json()) as { fields?: Record<string, never> };
    const d = decodeFields(j.fields ?? {});
    return d.role === "admin" && d.banned !== true ? { email: c.email } : { error: "forbidden" };
  } catch {
    return { error: "forbidden" };
  }
}

/** من ترويسة Authorization: Bearer ... */
export function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

/** هل البريد ضمن ADMIN_EMAILS؟ (فارغة = يُسمح لأي مسجَّل، مطابقًا لسلوك الموقع الحالي). */
export function isAdminEmail(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.length === 0 || admins.includes(email);
}
