// اختبار الصور المصغّرة على Neon (بلا شبكة ولا قاعدة): npx tsx --test neon/thumbs.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanThumbIds, cleanThumbSave } from "../lib/adminInput";
import { DELETE_THUMBS_SQL, READ_THUMB_SQL, SAVE_THUMB_SQL } from "../lib/adminSql";
import { JPEG_B64, MAX_B64, THUMB_ID, isSavableB64, parseJpegDataUrl } from "../lib/thumbCore";

const JPG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD" + "A".repeat(40) + "==";

test("data URL: JPEG فقط", () => {
  assert.equal(parseJpegDataUrl("data:image/jpeg;base64,/9j/4AAQ"), "/9j/4AAQ");
  assert.equal(parseJpegDataUrl("data:image/png;base64,iVBORw0"), null);
  assert.equal(parseJpegDataUrl("data:image/jpeg;base64,<script>"), null);
  assert.equal(parseJpegDataUrl("https://x/y.jpg"), null);
});

test("base64 صالح للحفظ: يبدأ بترويسة JPEG وضمن الحد", () => {
  assert.ok(isSavableB64(JPG));
  assert.ok(!isSavableB64("iVBORw0KGgo=")); // PNG
  assert.ok(!isSavableB64("/9j/" + "A".repeat(MAX_B64))); // أكبر من الحد
  assert.ok(!isSavableB64("/9j/abc<>"));
  assert.ok(!isSavableB64(5));
  assert.ok(JPEG_B64.test(JPG));
});

test("حفظ صورة: معرّف وصورة صالحان فقط", () => {
  assert.deepEqual(cleanThumbSave({ id: "abcdefghij1234567890", b64: JPG }), { id: "abcdefghij1234567890", b64: JPG });
  assert.equal(cleanThumbSave({ id: "short", b64: JPG }), null);
  assert.equal(cleanThumbSave({ id: "abc/../../etc1234567", b64: JPG }), null);
  assert.equal(cleanThumbSave({ id: "abcdefghij1234567890", b64: "AAAA" }), null);
  assert.equal(cleanThumbSave({ id: "abcdefghij1234567890" }), null);
  assert.equal(cleanThumbSave(null), null);
});

test("حذف صور: دفعة صالحة حتى 1000، وغير ذلك رفض", () => {
  assert.deepEqual(cleanThumbIds({ ids: ["abcdefghij1234567890", "abcdefghij1234567890", "zzzzzzzzzz"] }), ["abcdefghij1234567890", "zzzzzzzzzz"]);
  assert.equal(cleanThumbIds({ ids: [] }), null);
  assert.equal(cleanThumbIds({ ids: ["bad id"] }), null);
  assert.equal(cleanThumbIds({ ids: [1] }), null);
  assert.equal(cleanThumbIds({ ids: Array.from({ length: 1001 }, (_, i) => `id${String(i).padStart(10, "0")}`) }), null);
  assert.ok(THUMB_ID.test("0123456789"));
});

test("جمل SQL: upsert بمعاملات، وحذف بمصفوفة، وقراءة بمعرّف", () => {
  assert.match(SAVE_THUMB_SQL, /on conflict \(id\) do update set b64 = excluded\.b64/);
  assert.match(SAVE_THUMB_SQL, /\$1.*\$2/);
  assert.match(DELETE_THUMBS_SQL, /id = any\(\$1::text\[\]\)/);
  assert.match(READ_THUMB_SQL, /where id = \$1/);
  for (const q of [SAVE_THUMB_SQL, DELETE_THUMBS_SQL, READ_THUMB_SQL]) assert.doesNotMatch(q, /\$\{/);
});
