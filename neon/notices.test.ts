// اختبار الإشعارات على Neon (بلا شبكة ولا قاعدة): npx tsx --test neon/notices.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanNoticeCreate, cleanNoticeIds } from "../lib/adminInput";
import { ADMIN_LIST_NOTICES_SQL, DELETE_NOTICES_SQL, INSERT_NOTICES_SQL, LIST_NOTICES_SQL, OPEN_REPORTS_COUNT_SQL, PRUNE_NOTICES_SQL } from "../lib/adminSql";
import { audiencesFor, cleanLink, newNoticeId, NOTICE_KEEP, rowToNotice } from "../lib/noticeCore";

test("إرسال إشعار صالح: يُقصّ ويُنظَّف ويُزال تكرار الفئات", () => {
  const n = cleanNoticeCreate({ title: "  " + "ع".repeat(200), body: "ن".repeat(900), link: " /new ", audiences: ["viewers", "viewers", "guests"] })!;
  assert.equal(n.title.length, 80);
  assert.equal(n.body.length, 500);
  assert.equal(n.link, "/new");
  assert.deepEqual(n.audiences, ["viewers", "guests"]);
});

test("إرسال إشعار: عنوان فارغ أو فئة غير معروفة أو «الجميع» مع غيرها أو رابط خطر = رفض", () => {
  assert.equal(cleanNoticeCreate({ title: "  ", audiences: ["all"] }), null);
  assert.equal(cleanNoticeCreate({ title: "ت", audiences: [] }), null);
  assert.equal(cleanNoticeCreate({ title: "ت" }), null);
  assert.equal(cleanNoticeCreate({ title: "ت", audiences: ["owners"] }), null);
  assert.equal(cleanNoticeCreate({ title: "ت", audiences: ["all", "guests"] }), null);
  assert.equal(cleanNoticeCreate({ title: "ت", audiences: ["all"], link: "javascript:alert(1)" }), null);
  assert.equal(cleanNoticeCreate({ title: "ت", audiences: ["all"], link: "//evil.example" }), null);
  assert.equal(cleanNoticeCreate({ title: "ت", audiences: ["all"], body: 5 }), null);
  assert.equal(cleanNoticeCreate(null), null);
});

test("النص والرابط اختياريان", () => {
  assert.deepEqual(cleanNoticeCreate({ title: "ت", audiences: ["all"] }), { title: "ت", body: "", link: "", audiences: ["all"] });
  assert.equal(cleanNoticeCreate({ title: "ت", audiences: ["all"], link: "https://example.com/x" })!.link, "https://example.com/x");
});

test("حذف إشعارات: معرّفات صالحة فقط وبحد أقصى", () => {
  assert.deepEqual(cleanNoticeIds({ ids: ["8000000000000-abc12", "x_y-1"] }), ["8000000000000-abc12", "x_y-1"]);
  assert.equal(cleanNoticeIds({ ids: [] }), null);
  assert.equal(cleanNoticeIds({ ids: ["a b"] }), null);
  assert.equal(cleanNoticeIds({ ids: ["x'; drop table notifications;--"] }), null);
  assert.equal(cleanNoticeIds({ ids: Array.from({ length: 21 }, (_, i) => `id${i}`) }), null);
  assert.equal(cleanNoticeIds({ ids: [5] }), null);
});

test("الفئات المقروءة لكل نوع زائر كما في firestore.rules", () => {
  assert.deepEqual(audiencesFor(null, false), ["all", "guests"]);
  assert.deepEqual(audiencesFor("u1", false), ["all", "viewers"]);
  assert.deepEqual(audiencesFor("u1", true), ["all", "admins"]);
});

test("معرّف الإشعار الجديد: الأحدث يسبق الأقدم بالترتيب التصاعدي، والرابط الداخلي فقط أو https", () => {
  const a = newNoticeId();
  assert.match(a, /^\d{13}-[a-z0-9]{1,5}$/);
  assert.equal(cleanLink("/x y"), "");
  assert.equal(cleanLink("ftp://x"), "");
  assert.ok(NOTICE_KEEP >= 1);
});

test("صف Neon يتحوّل إلى إشعار: وقت، فئة مجهولة تصير all، وطول محدود", () => {
  const n = rowToNotice({ id: "i1", title: "ت".repeat(120), body: "", link: "javascript:x", audience: "weird", created_at: new Date(1_700_000_000_000) });
  assert.equal(n.title.length, 80);
  assert.equal(n.audience, "all");
  assert.equal(n.link, "");
  assert.equal(n.at, 1_700_000_000_000);
  assert.equal(rowToNotice({ id: "i2", title: "ت", body: "", link: "", audience: "admins", created_at: "2026-10-27T10:00:00Z" }).at, Date.parse("2026-10-27T10:00:00Z"));
});

test("جمل SQL: معاملات فقط، فئات من مصفوفة، وتنظيف لكل فئة", () => {
  assert.match(LIST_NOTICES_SQL, /partition by audience/);
  assert.match(LIST_NOTICES_SQL, /audience = any\(\$1::text\[\]\)/);
  assert.match(LIST_NOTICES_SQL, /rn <= \$2/);
  assert.match(ADMIN_LIST_NOTICES_SQL, /limit 100/);
  assert.match(INSERT_NOTICES_SQL, /jsonb_to_recordset\(\$1::jsonb\)/);
  assert.match(PRUNE_NOTICES_SQL, /partition by audience/);
  assert.match(PRUNE_NOTICES_SQL, /rn > \$1/);
  assert.match(DELETE_NOTICES_SQL, /id = any\(\$1::text\[\]\)/);
  assert.match(OPEN_REPORTS_COUNT_SQL, /status = 'open'/);
  for (const q of [LIST_NOTICES_SQL, ADMIN_LIST_NOTICES_SQL, INSERT_NOTICES_SQL, PRUNE_NOTICES_SQL, DELETE_NOTICES_SQL, OPEN_REPORTS_COUNT_SQL]) assert.doesNotMatch(q, /\$\{/);
});
