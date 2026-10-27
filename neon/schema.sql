-- مخطط Neon (Postgres) المقترح لمشروع wqar.kids  — مسودة للمراجعة، لم تُنفَّذ على أي قاعدة بيانات.
-- يقابل كل جدول مجموعة في Firestore (انظر firestore.rules). تسجيل الدخول يبقى على Firebase Auth؛
-- لذلك users.uid هو معرّف Firebase نفسه. معرّفات المستندات تبقى نصوصًا كما هي كي لا تتغير الروابط (/v/<id>).

create table if not exists categories (
  id             text primary key,
  name           text not null,
  cover_video_id text not null default '',
  cover_image    text not null default '',
  avatar_url     text not null default ''
);
create index if not exists categories_name_idx on categories (name);

create table if not exists series (
  id             text primary key,
  name           text not null,
  cover_video_id text not null default '',
  cover_image    text not null default '',
  avatar_url     text not null default ''
);
create index if not exists series_name_idx on series (name);

create table if not exists videos (
  id            text primary key,
  title         text not null,
  drive_id      text not null default '',
  youtube_id    text not null default '',          -- فارغ = فيديو درايف
  thumbnail     text not null default '',
  description   text not null default '',
  category_id   text not null default '',
  category_name text not null default '',
  series_id     text not null default '',
  series_name   text not null default '',
  season        integer,
  episode       integer,
  is_short      boolean not null default false,
  hidden        boolean not null default false,
  duration      integer,                           -- ثوانٍ، null = غير معروفة
  clip          boolean not null default false,    -- مقطع قديم يُخفى عن الزوار
  series_order  integer,
  views         integer not null default 0 check (views >= 0),
  likes         integer not null default 0 check (likes >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists videos_created_idx  on videos (created_at desc);
create index if not exists videos_category_idx on videos (category_id);
create index if not exists videos_series_idx   on videos (series_id);
create index if not exists videos_public_idx   on videos (hidden, is_short, created_at desc);

-- إعدادات الموقع: مستند واحد كبير (settings/site) بشكل JSON متداخل.
create table if not exists settings (
  key        text primary key,                     -- 'site'
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- إحصاء المشاهدات اليومي لمخطط الإقبال (كان stats/d-YYYY-MM-DD).
create table if not exists stats (
  day   date primary key,
  views integer not null default 0 check (views >= 0)
);

create table if not exists reports (
  id          text primary key,
  video_id    text not null,
  video_title text not null,
  reason      text not null,
  note        text not null default '',
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);
create index if not exists reports_status_idx on reports (status, created_at desc);

create table if not exists notifications (
  id         text primary key,
  title      text not null check (length(title) between 1 and 80),
  body       text not null default '' check (length(body) <= 500),
  link       text not null default '' check (length(link) <= 300),
  audience   text not null check (audience in ('all', 'viewers', 'admins', 'guests')),
  created_at timestamptz not null default now()
);
create index if not exists notifications_aud_idx on notifications (audience, created_at desc);

-- بصمات الفيديوهات لكشف المقدمة والإعلان، وصور مصغّرة base64 (للمشرف فقط / تُخدم عبر /api/thumb).
create table if not exists fingerprints (
  id         text primary key,                     -- معرّف الفيديو
  fp         text not null,
  created_at timestamptz not null default now()
);

create table if not exists thumbs (
  id         text primary key,                     -- معرّف الفيديو
  b64        text not null,
  updated_at timestamptz not null default now()
);

-- التسجيل الذاتي مُغلق: المالك يضيف بريدًا هنا، ثم يستطيع صاحبه إنشاء حسابه.
create table if not exists allowed (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- الأعضاء. uid = معرّف Firebase Auth.
create table if not exists users (
  uid           text primary key,
  email         text not null,
  name          text not null default '' check (length(name) <= 60),
  avatar        text not null default '' check (length(avatar) <= 20),
  role          text not null default 'viewer' check (role in ('viewer', 'admin')),
  banned        boolean not null default false,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create index if not exists users_email_idx on users (lower(email));

-- ملاحظات:
-- 1) «المالك» لا يُخزَّن هنا: يبقى بريده في ADMIN_EMAILS (متغير بيئة) كما في firestore.rules الحالية.
-- 2) صلاحيات القراءة والكتابة التي كانت في firestore.rules تنتقل إلى كود الخادم (مسارات API) بعد التحقق من رمز Firebase.
-- 3) زيادة المشاهدات والإعجابات تصير UPDATE ذرّيًا:  update videos set views = views + 1 where id = $1
-- 4) قد توجد حقول إضافية في مستندات Firestore الفعلية لم تظهر في الكود؛ يُراجَع هذا قبل الاستيراد على بيانات التصدير الحقيقية.
