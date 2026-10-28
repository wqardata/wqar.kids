// اختبار تحقق مدخلات المشرف وبناء جمل التعديل (بلا شبكة ولا قاعدة): npx tsx --test neon/admin.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanBulk, cleanImport, cleanIds, cleanName, cleanNamedPatch, cleanOrder, cleanReportOp, cleanThumb, cleanVideoCreate, cleanVideoPatch } from "../lib/adminInput";
import { newId, setClause } from "../lib/adminSql";

test("تعديل فيديو: الحقول المسموحة فقط، والمحمية (views/likes/createdAt) تُهمل", () => {
  const p = cleanVideoPatch({ title: "  عنوان ", views: 999, likes: 5, createdAt: 1, id: "x", hidden: true, season: 2.7 });
  assert.deepEqual(p, { title: "عنوان", hidden: true, season: 2 });
});

test("تعديل فيديو: أنواع خاطئة أو عنوان فارغ أو لا حقول = رفض", () => {
  assert.equal(cleanVideoPatch({ title: "   " }), null);
  assert.equal(cleanVideoPatch({ hidden: "yes" }), null);
  assert.equal(cleanVideoPatch({ season: "2" }), null);
  assert.equal(cleanVideoPatch({ categoryId: "a b" }), null);
  assert.equal(cleanVideoPatch({ views: 5 }), null);
  assert.equal(cleanVideoPatch(null), null);
});

test("القيم الفارغة المقصودة تُقبل: null للموسم والترتيب، وفراغ للمجموعة", () => {
  assert.deepEqual(cleanVideoPatch({ seriesId: "", seriesName: "", season: null, episode: null, seriesOrder: null }), { seriesId: "", seriesName: "", season: null, episode: null, seriesOrder: null });
});

test("العنوان والوصف يُقصّان إلى الحدود", () => {
  const p = cleanVideoPatch({ title: "ع".repeat(300), description: "x".repeat(2000) })!;
  assert.equal(p.title!.length, 150);
  assert.equal(p.description!.length, 1000);
});

test("الصورة المصغّرة: داخلية أو https فقط", () => {
  assert.equal(cleanThumb("/api/thumb/abcdefghij1234567890?v=12"), "/api/thumb/abcdefghij1234567890?v=12");
  assert.equal(cleanThumb("https://drive.google.com/thumbnail?id=abc"), "https://drive.google.com/thumbnail?id=abc");
  assert.equal(cleanThumb("javascript:alert(1)"), "");
  assert.equal(cleanThumb("http://evil.example/x.png"), "");
  assert.equal(cleanThumb("//evil.example/x.png"), "");
});

test("فيديو جديد: درايف أو يوتيوب (واحد فقط)", () => {
  const ok = cleanVideoCreate({ title: "ت", driveId: "1AbCdEfGhIjKlMnOp", categoryId: "c1", categoryName: "ق" });
  assert.ok(ok);
  assert.equal(ok!.youtubeId, "");
  assert.equal(ok!.hidden, false);
  assert.ok(cleanVideoCreate({ title: "ت", youtubeId: "dQw4w9WgXcQ", isShort: true }));
  assert.equal(cleanVideoCreate({ title: "ت" }), null);
  assert.equal(cleanVideoCreate({ title: "ت", driveId: "1AbCdEfGhIjKlMnOp", youtubeId: "dQw4w9WgXcQ" }), null);
  assert.equal(cleanVideoCreate({ title: "", driveId: "1AbCdEfGhIjKlMnOp" }), null);
  assert.equal(cleanVideoCreate({ title: "ت", youtubeId: "short" }), null);
  assert.equal(cleanVideoCreate({ title: "ت", driveId: "1AbCdEfGhIjKlMnOp", id: "bad id" }), null);
});

test("معرّف الفيديو المسبق والتاريخ يمرّان، والمحمي لا يمرّ", () => {
  const v = cleanVideoCreate({ title: "ت", driveId: "1AbCdEfGhIjKlMnOp", id: "AbCdEfGhIjKlMnOpQrSt", createdAt: 1700000000123.9, views: 50 })!;
  assert.equal(v.id, "AbCdEfGhIjKlMnOpQrSt");
  assert.equal(v.createdAt, 1700000000123);
  assert.ok(!("views" in v));
});

test("استيراد: حتى 500، وأي عنصر فاسد يُسقط الدفعة كلها", () => {
  const one = { title: "ت", driveId: "1AbCdEfGhIjKlMnOp" };
  assert.equal(cleanImport({ videos: [one, one] })!.length, 2);
  assert.equal(cleanImport({ videos: [one, { title: "" }] }), null);
  assert.equal(cleanImport({ videos: [] }), null);
  assert.equal(cleanImport({ videos: Array(501).fill(one) }), null);
});

test("تعديل جماعي: التصنيف/المجموعة/الظهور فقط", () => {
  assert.ok(cleanBulk({ ids: ["a1", "b2"], patch: { hidden: true } }));
  assert.ok(cleanBulk({ ids: ["a1"], patch: { seriesId: "", seriesName: "", seriesOrder: null, season: null, episode: null } }));
  assert.equal(cleanBulk({ ids: ["a1"], patch: { title: "x" } }), null); // لا عنوان جماعي
  assert.equal(cleanBulk({ ids: [], patch: { hidden: true } }), null);
  assert.equal(cleanBulk({ ids: ["a/b"], patch: { hidden: true } }), null);
});

test("المعرّفات: بلا تكرار وبحد أقصى", () => {
  assert.deepEqual(cleanIds(["a", "a", "b"]), ["a", "b"]);
  assert.equal(cleanIds(Array.from({ length: 1001 }, (_, i) => `v${i}`)), null);
  assert.equal(cleanIds("a"), null);
});

test("ترتيب الحلقات", () => {
  assert.deepEqual(cleanOrder({ seriesId: "s1", ids: ["a", "b"] }), { seriesId: "s1", ids: ["a", "b"] });
  assert.equal(cleanOrder({ seriesId: "", ids: ["a"] }), null);
});

test("الأسماء: ضغط الفراغات وقصّ 80 حرفًا ورفض الفارغ", () => {
  assert.equal(cleanName("  قصص   الأنبياء "), "قصص الأنبياء");
  assert.equal(cleanName("   "), null);
  assert.equal(cleanName("ا".repeat(200))!.length, 80);
});

test("تعديل تصنيف/مجموعة: روابط الصور تُنقّى", () => {
  assert.deepEqual(cleanNamedPatch({ name: " س ", coverVideoId: "v1", role: "admin" }), { name: "س", coverVideoId: "v1" });
  assert.deepEqual(cleanNamedPatch({ coverImage: "http://evil/x.png" }), { coverImage: "" });
  assert.equal(cleanNamedPatch({ name: "" }), null);
  assert.equal(cleanNamedPatch({ role: "admin" }), null);
});

test("عمليات البلاغات", () => {
  assert.deepEqual(cleanReportOp({ op: "done", id: "AbCdEfGhIjKlMnOpQrSt" }), { op: "done", id: "AbCdEfGhIjKlMnOpQrSt" });
  assert.deepEqual(cleanReportOp({ op: "hide", id: "AbCdEfGhIjKlMnOpQrSt", videoId: "v1" }), { op: "hide", id: "AbCdEfGhIjKlMnOpQrSt", videoId: "v1" });
  assert.equal(cleanReportOp({ op: "hide", id: "AbCdEfGhIjKlMnOpQrSt" }), null);
  assert.equal(cleanReportOp({ op: "drop", id: "AbCdEfGhIjKlMnOpQrSt" }), null);
  assert.equal(cleanReportOp({ op: "done", id: "x; drop table reports" }), null);
});

test("بناء SET: أسماء أعمدة ثابتة والقيم معاملات فقط (لا حقن)", () => {
  const s = setClause({ title: "x'; drop table videos;--", hidden: true, seriesOrder: null }, 2);
  assert.equal(s.sql, "title = $2, hidden = $3, series_order = $4");
  assert.deepEqual(s.params, ["x'; drop table videos;--", true, null]);
  assert.equal(setClause({}, 2).sql, "");
});

test("معرّف جديد: 20 حرفًا وأرقامًا ومتفرّد", () => {
  const ids = new Set(Array.from({ length: 500 }, newId));
  assert.equal(ids.size, 500);
  for (const i of ids) assert.match(i, /^[A-Za-z0-9]{20}$/);
});
