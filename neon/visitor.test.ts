// اختبار تحقق مدخلات الزوار والمحدّد (بلا شبكة): npx tsx --test neon/visitor.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanDelta, cleanReport, cleanVideoId } from "../lib/visitorInput";
import { allow } from "../lib/rateLimit";

test("بلاغ صالح يُنظَّف ويُقصّ", () => {
  const r = cleanReport({ videoId: "abc123", videoTitle: "ع".repeat(300), reason: "  الفيديو لا يعمل ", note: "  " + "x".repeat(600) });
  assert.ok(r);
  assert.equal(r!.videoTitle.length, 200);
  assert.equal(r!.reason, "الفيديو لا يعمل");
  assert.equal(r!.note.length, 500);
});

test("بلاغ غير صالح يُرفض", () => {
  assert.equal(cleanReport(null), null);
  assert.equal(cleanReport({ videoId: "a/b", reason: "x" }), null);
  assert.equal(cleanReport({ videoId: "a".repeat(41), reason: "x" }), null); // حد القواعد: 40
  assert.equal(cleanReport({ videoId: "abc", reason: "   " }), null);
  assert.equal(cleanReport({ videoId: "abc", reason: 5 }), null);
  assert.equal(cleanReport({ videoId: 7, reason: "x" }), null);
});

test("حقول اختيارية غير نصية تصبح فارغة", () => {
  const r = cleanReport({ videoId: "abc", reason: "x", note: 5, videoTitle: {} });
  assert.deepEqual(r, { videoId: "abc", videoTitle: "", reason: "x", note: "" });
});

test("معرّف الفيديو والإعجاب", () => {
  assert.equal(cleanVideoId({ id: "Ab_-9" }), "Ab_-9");
  assert.equal(cleanVideoId({ id: "a b" }), null);
  assert.equal(cleanVideoId({ id: "'; drop table videos;--" }), null);
  assert.equal(cleanVideoId(undefined), null);
  assert.equal(cleanDelta({ delta: 1 }), 1);
  assert.equal(cleanDelta({ delta: -1 }), -1);
  assert.equal(cleanDelta({ delta: 2 }), null);
  assert.equal(cleanDelta({ delta: "1" }), null);
});

test("المحدّد: يسمح حتى الحد ثم يمنع ثم يعود بعد النافذة", () => {
  const k = "t1";
  assert.equal(allow(k, 2, 1000, 0), true);
  assert.equal(allow(k, 2, 1000, 10), true);
  assert.equal(allow(k, 2, 1000, 20), false);
  assert.equal(allow(k, 2, 1000, 1500), true);
  assert.equal(allow("other", 2, 1000, 20), true); // مفتاح آخر مستقل
});
