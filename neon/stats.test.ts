// اختبار استعلامات تبويب الإحصاءات على Neon (بلا شبكة ولا قاعدة): npx tsx --test neon/stats.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { STATS_DAILY_SQL, STATS_TOTALS_SQL } from "../lib/adminSql";

test("المجاميع: جملة قراءة واحدة تغطي المشاهدات والإعجابات والمخفي والقصير والبلاغات المفتوحة", () => {
  const s = STATS_TOTALS_SQL.toLowerCase();
  assert.ok(s.startsWith("select"));
  for (const part of ["sum(views)", "sum(likes)", "count(*)", "where hidden", "where is_short", "from reports where status = 'open'", "from videos"]) {
    assert.ok(s.includes(part), part);
  }
  assert.ok(!/\b(insert|update|delete|drop|alter)\b/.test(s), "قراءة فقط");
});

test("مخطط الأيام: معاملان ($1 تاريخ البداية و$2 الحد) وترتيب بالأقدم أولًا من جدول stats", () => {
  const s = STATS_DAILY_SQL.toLowerCase();
  assert.ok(s.includes("from stats"));
  assert.ok(s.includes("day::text >= $1::text"), "مقارنة نصّية تعمل لنوعي العمود date ونص");
  assert.ok(s.includes("order by 1"));
  assert.ok(s.includes("limit $2::int"));
  assert.ok(s.includes("day::text"), "اليوم نصًّا YYYY-MM-DD ليطابق dayKey");
  assert.ok(!/\b(insert|update|delete|drop|alter)\b/.test(s), "قراءة فقط");
});
