// اختبار محوّلات صفوف Neon (بلا شبكة): npx tsx --test neon/rows.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { rowToNamed, rowToVideo, type VideoRow } from "../lib/neonRows";

const base: VideoRow = {
  id: "v1", title: "عنوان", drive_id: "abc", youtube_id: "", thumbnail: "", description: "وصف",
  category_id: "c1", category_name: "تصنيف", series_id: "s1", series_name: "مجموعة", season: 1, episode: 2,
  is_short: false, hidden: false, duration: 61.4, clip: false, series_order: null, views: 5, likes: 1,
  created_at: new Date("2026-01-02T03:04:05Z"),
};

test("فيديو عادي: الحقول والتاريخ بالمللي ثانية", () => {
  const v = rowToVideo(base);
  assert.equal(v.createdAt, Date.parse("2026-01-02T03:04:05Z"));
  assert.equal(v.duration, 61);
  assert.equal(v.seriesOrder, null);
  assert.equal(v.hidden, false);
  assert.equal(v.driveId, "abc");
});

test("المقطع القديم clip يُعامل كمخفي", () => {
  assert.equal(rowToVideo({ ...base, clip: true }).hidden, true);
  assert.equal(rowToVideo({ ...base, clip: true }).clip, true);
});

test("معرّف يوتيوب غير صالح يُفرَّغ، والصالح يبقى", () => {
  assert.equal(rowToVideo({ ...base, youtube_id: "short" }).youtubeId, "");
  assert.equal(rowToVideo({ ...base, youtube_id: "dQw4w9WgXcQ" }).youtubeId, "dQw4w9WgXcQ");
});

test("قيم null أو غير صالحة لا تكسر التحويل", () => {
  const v = rowToVideo({ ...base, title: null, duration: 0, views: -3, likes: null, created_at: null, season: null });
  assert.equal(v.title, "");
  assert.equal(v.duration, null);
  assert.equal(v.views, 0);
  assert.equal(v.likes, 0);
  assert.equal(v.createdAt, null);
  assert.equal(v.season, null);
});

test("created_at كنص ISO يُقبل أيضًا", () => {
  assert.equal(rowToVideo({ ...base, created_at: "2026-01-02T03:04:05.000Z" }).createdAt, Date.parse("2026-01-02T03:04:05Z"));
});

test("مجموعة: صورة الغلاف تُنظَّف والرابط الغريب يُمسح", () => {
  const ok = rowToNamed({ id: "s", name: "م", cover_video_id: "v", cover_image: "/api/thumb/abcdefghij1234", avatar_url: "" });
  assert.equal(ok.coverImage, "/api/thumb/abcdefghij1234");
  assert.equal(ok.avatarUrl, "");
  const bad = rowToNamed({ id: "s", name: null, cover_video_id: null, cover_image: "http://evil.example/x.png", avatar_url: "/x" });
  assert.equal(bad.coverImage, "");
  assert.equal(bad.name, "");
  assert.equal(bad.avatarUrl, "/x");
});
