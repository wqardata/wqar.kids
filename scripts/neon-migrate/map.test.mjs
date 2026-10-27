import test from "node:test";
import assert from "node:assert/strict";
import { PLAN, iso, mapAllowed, mapNotification, mapStat, mapUser, mapVideo, plain, upsert } from "./map.mjs";

const ts = (ms) => ({ toDate: () => new Date(ms) });

test("فيديو: تحويل الحقول والقيم الافتراضية", () => {
  const { row } = mapVideo("abc", { title: "T", driveId: "D", youtubeId: "bad", views: 12.9, likes: -3, season: 2, createdAt: ts(0), clipStart: 1, clipEnd: 5 }, null);
  assert.equal(row.title, "T");
  assert.equal(row.youtube_id, "");
  assert.equal(row.views, 12);
  assert.equal(row.likes, 0);
  assert.equal(row.season, 2);
  assert.equal(row.episode, null);
  assert.equal(row.clip, true);
  assert.equal(row.hidden, false);
  assert.equal(row.created_at, "1970-01-01T00:00:00.000Z");
});

test("فيديو بلا createdAt يأخذ وقت إنشاء المستند", () => {
  const { row } = mapVideo("x", { title: "t" }, ts(86400000));
  assert.equal(row.created_at, "1970-01-02T00:00:00.000Z");
  const a = mapVideo("y", { title: "t" }, null).row.created_at;
  assert.ok(!Number.isNaN(Date.parse(a)));
});

test("إحصاء اليوم من الحقل أو من المعرّف", () => {
  assert.deepEqual(mapStat("d-2026-10-27", { day: "2026-10-27", views: 5 }).row, { day: "2026-10-27", views: 5 });
  assert.equal(mapStat("d-2026-10-28", { views: 1 }).row.day, "2026-10-28");
  assert.ok(mapStat("zzz", {}).skip);
});

test("إشعار: حدود الطول والفئة", () => {
  assert.ok(mapNotification("n", { title: "" }).skip);
  const { row } = mapNotification("n", { title: "x".repeat(200), audience: "weird" }, null);
  assert.equal(row.title.length, 80);
  assert.equal(row.audience, "all");
});

test("عضو ومسموح: البريد بأحرف صغيرة والدور مضبوط", () => {
  assert.equal(mapUser("u1", { email: "A@B.com", role: "owner" }, null).row.role, "viewer");
  assert.equal(mapUser("u1", { email: "A@B.com", role: "admin" }, null).row.email, "a@b.com");
  assert.ok(mapUser("u2", {}, null).skip);
  assert.equal(mapAllowed("X@Y.com", { name: "N" }, null).row.email, "x@y.com");
});

test("plain: Timestamp متداخل ← ISO", () => {
  assert.deepEqual(plain({ a: { b: ts(0) }, c: [ts(0), 1] }), { a: { b: "1970-01-01T00:00:00.000Z" }, c: ["1970-01-01T00:00:00.000Z", 1] });
  assert.equal(iso("x"), null);
});

test("upsert: عبارة صحيحة وcast لـ jsonb ولا تعدّل المفتاح", () => {
  const settings = PLAN.find((s) => s.coll === "settings");
  const { text, params } = upsert(settings, { key: "site", data: "{}" });
  assert.equal(text, "insert into settings (key, data) values ($1, $2::jsonb) on conflict (key) do update set data = excluded.data");
  assert.deepEqual(params, ["site", "{}"]);
});

test("كل جدول في PLAN له صفوف تحمل مفتاحه الأساسي", () => {
  const sample = {
    categories: ["c", { name: "n" }], series: ["s", { name: "n" }], videos: ["v", { title: "t" }], settings: ["site", { a: 1 }],
    stats: ["d-2026-01-01", { views: 1 }], reports: ["r", { reason: "x" }], notifications: ["n", { title: "t" }],
    fingerprints: ["f", { fp: "abc" }], thumbs: ["t", { b64: "abc" }], allowed: ["a@b.c", {}], users: ["u", { email: "a@b.c" }],
  };
  for (const step of PLAN) {
    const [id, d] = sample[step.coll];
    const { row } = step.map(id, d, null);
    assert.ok(row && row[step.pk] !== undefined, step.coll);
  }
  assert.equal(PLAN.length, 11);
});
