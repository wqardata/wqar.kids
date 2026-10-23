import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

/** يتحقق من توكن Firebase ويعيد البريد (بحروف صغيرة)، أو null إن كان غير صالح أو بريده غير موثّق. */
export async function emailFromToken(token: string): Promise<string | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !projectId) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (payload.email_verified !== true || typeof payload.email !== "string") return null;
    return payload.email.toLowerCase();
  } catch {
    return null;
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
