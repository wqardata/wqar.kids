// تحويل مستندات Firestore إلى صفوف Neon. دوال خالصة بلا اعتماديات (قابلة للاختبار)؛ المخطط في neon/schema.sql.
// كل دالة تستقبل (معرّف المستند، بياناته، وقت إنشائه) وتعيد { row } أو { skip: السبب }.

const str = (v, max = 0) => {
  const s = typeof v === "string" ? v : "";
  return max ? s.slice(0, max) : s;
};
const intOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const count = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Timestamp من Firestore (أو Date) ← نص ISO، أو null. */
export function iso(v) {
  const d = v && typeof v.toDate === "function" ? v.toDate() : v instanceof Date ? v : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}
/** وقت الإنشاء: الحقل createdAt، ثم وقت إنشاء المستند نفسه، ثم الآن (العمود لا يقبل null). */
const created = (d, createTime) => iso(d.createdAt) ?? iso(createTime) ?? new Date().toISOString();

/** يحوّل قيمًا من Firestore داخل كائن إلى JSON عادي (Timestamp ← ISO، مصفوفات وكائنات متداخلة). */
export function plain(v) {
  if (v && typeof v.toDate === "function") return iso(v);
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

export const mapNamed = (id, d, ct) => ({
  row: {
    id,
    name: str(d.name),
    cover_video_id: str(d.coverVideoId),
    cover_image: str(d.coverImage),
    avatar_url: str(d.avatarUrl),
  },
});

export const mapVideo = (id, d, ct) => {
  const clip = typeof d.clipStart === "number" && typeof d.clipEnd === "number";
  const yt = str(d.youtubeId);
  return {
    row: {
      id,
      title: str(d.title),
      drive_id: str(d.driveId),
      youtube_id: /^[A-Za-z0-9_-]{11}$/.test(yt) ? yt : "",
      thumbnail: str(d.thumbnail),
      description: str(d.description),
      category_id: str(d.categoryId),
      category_name: str(d.categoryName),
      series_id: str(d.seriesId),
      series_name: str(d.seriesName),
      season: intOrNull(d.season),
      episode: intOrNull(d.episode),
      is_short: d.isShort === true,
      hidden: d.hidden === true, // المقطع القديم (clip) يُعامل كمخفي في الواجهة؛ نحفظ الحقلين منفصلين كما في المصدر
      duration: typeof d.duration === "number" && d.duration > 0 ? Math.round(d.duration) : null,
      clip,
      series_order: intOrNull(d.seriesOrder),
      views: count(d.views),
      likes: count(d.likes),
      created_at: created(d, ct),
    },
  };
};

export const mapSetting = (id, d) => ({ row: { key: id, data: JSON.stringify(plain(d)) } });

/** stats/d-YYYY-MM-DD: الحقل day إن وُجد وإلا من المعرّف. */
export const mapStat = (id, d) => {
  const day = typeof d.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : /^d-(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1];
  return day ? { row: { day, views: count(d.views) } } : { skip: "معرّف يوم غير صالح" };
};

export const mapReport = (id, d, ct) => ({
  row: {
    id,
    video_id: str(d.videoId, 40),
    video_title: str(d.videoTitle, 200),
    reason: str(d.reason, 80),
    note: str(d.note, 500),
    status: d.status === "done" ? "done" : "open",
    created_at: created(d, ct),
  },
});

export const mapNotification = (id, d, ct) => {
  const title = str(d.title, 80);
  if (!title) return { skip: "إشعار بلا عنوان" };
  const audience = ["all", "viewers", "admins", "guests"].includes(d.audience) ? d.audience : "all";
  return { row: { id, title, body: str(d.body, 500), link: str(d.link, 300), audience, created_at: created(d, ct) } };
};

export const mapFingerprint = (id, d, ct) =>
  typeof d.fp === "string" && d.fp ? { row: { id, fp: d.fp, created_at: created(d, ct) } } : { skip: "بصمة فارغة" };

export const mapThumb = (id, d, ct) =>
  typeof d.b64 === "string" && d.b64 ? { row: { id, b64: d.b64, updated_at: created(d, ct) } } : { skip: "صورة فارغة" };

export const mapAllowed = (id, d, ct) => {
  const email = (str(d.email) || id).trim().toLowerCase();
  return email ? { row: { email, name: str(d.name, 60), created_at: created(d, ct) } } : { skip: "بريد فارغ" };
};

export const mapUser = (id, d, ct) => {
  const email = str(d.email, 200).toLowerCase();
  if (!email) return { skip: "عضو بلا بريد" };
  return {
    row: {
      uid: id,
      email,
      name: str(d.name, 60),
      avatar: str(d.avatar, 20),
      role: d.role === "admin" ? "admin" : "viewer",
      banned: d.banned === true,
      created_at: created(d, ct),
      last_login_at: iso(d.lastLoginAt),
    },
  };
};

/**
 * جدول التحويل: مجموعة Firestore ← جدول Neon، مفتاحه الأساسي، ودالة التحويل.
 * cast: نوع يُضاف للمعامل (مثلًا jsonb). الأعمدة تؤخذ من مفاتيح الصف الناتج.
 */
export const PLAN = [
  { coll: "categories", table: "categories", pk: "id", map: mapNamed },
  { coll: "series", table: "series", pk: "id", map: mapNamed },
  { coll: "videos", table: "videos", pk: "id", map: mapVideo },
  { coll: "settings", table: "settings", pk: "key", map: mapSetting, cast: { data: "jsonb" } },
  { coll: "stats", table: "stats", pk: "day", map: mapStat },
  { coll: "reports", table: "reports", pk: "id", map: mapReport },
  { coll: "notifications", table: "notifications", pk: "id", map: mapNotification },
  { coll: "fingerprints", table: "fingerprints", pk: "id", map: mapFingerprint },
  { coll: "thumbs", table: "thumbs", pk: "id", map: mapThumb },
  // الأعضاء والتسجيل (users/allowed) يبقون على Firestore بقرار المالك: لا تُنسخ إلى Neon.
];

/** عبارة upsert لصف: insert ... on conflict (pk) do update. أسماء الجداول والأعمدة من PLAN/المحوّلات فقط (ليست مدخلات خارجية). */
export function upsert(step, row) {
  const cols = Object.keys(row);
  const params = cols.map((c) => row[c]);
  const ph = cols.map((c, i) => `$${i + 1}${step.cast?.[c] ? `::${step.cast[c]}` : ""}`);
  const sets = cols.filter((c) => c !== step.pk).map((c) => `${c} = excluded.${c}`);
  const text = `insert into ${step.table} (${cols.join(", ")}) values (${ph.join(", ")}) on conflict (${step.pk}) do update set ${sets.join(", ")}`;
  return { text, params };
}
