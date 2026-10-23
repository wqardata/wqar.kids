export type Role = "viewer" | "admin";

/** سجل العضو في Firestore: users/{uid}. */
export type Profile = {
  uid: string;
  email: string;
  name: string;
  avatar: string;
  role: Role;
  banned: boolean;
  createdAt: number | null;
  lastLoginAt: number | null;
};

export const ROLE_LABEL: Record<Role, string> = { viewer: "مشاهد", admin: "مشرف" };
export const ROLE_PERMS: Record<Role, string> = {
  viewer: "مشاهدة، مفضلة، إعجاب، إبلاغ",
  admin: "كل صلاحيات المشاهد + لوحة التحكم (الفيديوهات، البلاغات، البث، المظهر، الإعدادات)",
};

function ts(v: unknown): number | null {
  const t = v as { toMillis?: () => number } | null;
  return t && typeof t.toMillis === "function" ? t.toMillis() : null;
}

export function toProfile(uid: string, d: Record<string, unknown>): Profile {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  return {
    uid,
    email: s("email"),
    name: s("name"),
    avatar: s("avatar"),
    role: d.role === "admin" ? "admin" : "viewer",
    banned: d.banned === true,
    createdAt: ts(d.createdAt),
    lastLoginAt: ts(d.lastLoginAt),
  };
}
