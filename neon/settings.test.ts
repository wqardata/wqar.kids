// اختبار تحقق كتابات الإعدادات وجمل SQL الخاصة بها (بلا شبكة ولا قاعدة): npx tsx --test neon/settings.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanLayout, cleanSitePatch, MAX_LAYOUT_JSON } from "../lib/adminInput";
import { RESET_LAYOUT_SQL, SAVE_LAYOUT_SQL, SAVE_SITE_SQL } from "../lib/adminSql";
import { DEFAULT_SETTINGS } from "../lib/settingsCore";

test("إعدادات الموقع: الحقول المرسَلة فقط تعود منظّفة، والباقي لا يُلمس", () => {
  const p = cleanSitePatch({ patch: { siteName: "  عالم الصغار  ", glass: 9999 } });
  assert.ok(p);
  assert.deepEqual(Object.keys(p!).sort(), ["glass", "siteName"]);
  assert.equal(p!.siteName, "عالم الصغار");
  assert.ok((p!.glass as number) <= 100 && (p!.glass as number) >= 0); // ضُبط على الحد، لا القيمة الخام
});

test("إعدادات الموقع: حقول مجهولة أو محمية تُهمل، ولا حقول معروفة = رفض", () => {
  const p = cleanSitePatch({ patch: { siteName: "س", views: 5, isAdmin: true, __proto__: { x: 1 } } });
  assert.deepEqual(Object.keys(p!), ["siteName"]);
  assert.equal(cleanSitePatch({ patch: { views: 5 } }), null);
  assert.equal(cleanSitePatch({ patch: {} }), null);
  assert.equal(cleanSitePatch({ patch: [1] }), null);
  assert.equal(cleanSitePatch({}), null);
  assert.equal(cleanSitePatch(null), null);
});

test("إعدادات الموقع: روابط وشعار وألوان غير صالحة تُنظَّف كما عند القراءة", () => {
  const p = cleanSitePatch({ patch: { liveUrl: "javascript:alert(1)", logo: "data:text/html;base64,AAAA", brandColor: "red", logoHeight: 99999 } })!;
  assert.equal(p.liveUrl, "");
  assert.equal(p.logo, "");
  assert.equal(p.brandColor, "");
  assert.ok((p.logoHeight as number) < 99999);
});

test("إعدادات الموقع: عدم إرسال حقل لا يملؤه بالقيمة الافتراضية", () => {
  const p = cleanSitePatch({ patch: { siteName: "س" } })!;
  assert.equal("logo" in p, false);
  assert.equal("theme" in p, false);
  assert.notEqual(p.siteName, DEFAULT_SETTINGS.siteName);
});

test("تخطيط اللوحة: نصّا JSON صالحان فقط وبحد أقصى للحجم", () => {
  const ok = cleanLayout({ json: JSON.stringify({ a: [1] }), structure: JSON.stringify({ tabs: [] }) });
  assert.deepEqual(ok, { json: '{"a":[1]}', structure: '{"tabs":[]}' });
  assert.equal(cleanLayout({ json: "{bad", structure: "{}" }), null);
  assert.equal(cleanLayout({ json: "5", structure: "{}" }), null); // ليس كائنًا ولا مصفوفة
  assert.equal(cleanLayout({ json: "null", structure: "{}" }), null);
  assert.equal(cleanLayout({ json: "{}", structure: 7 }), null);
  assert.equal(cleanLayout({ json: JSON.stringify({ x: "y".repeat(MAX_LAYOUT_JSON) }), structure: "{}" }), null);
  assert.equal(cleanLayout(null), null);
});

test("جمل SQL: الدمج السطحي للموقع، والاستبدال الكامل للتخطيط، وكلها بمعاملات لا نصوص ملصوقة", () => {
  assert.match(SAVE_SITE_SQL, /settings\.data \|\| excluded\.data/);
  assert.match(SAVE_SITE_SQL, /\$1::jsonb/);
  assert.match(SAVE_LAYOUT_SQL, /\$1::text/);
  assert.match(SAVE_LAYOUT_SQL, /\$2::text/);
  assert.match(SAVE_LAYOUT_SQL, /data = excluded\.data/);
  assert.match(RESET_LAYOUT_SQL, /key = 'adminLayout'/);
  for (const q of [SAVE_SITE_SQL, SAVE_LAYOUT_SQL, RESET_LAYOUT_SQL]) assert.doesNotMatch(q, /\$\{/);
});
