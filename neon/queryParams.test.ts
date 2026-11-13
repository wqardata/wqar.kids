// اختبار رفض المعاملات غير المعروفة (حماية كاش CDN): npx tsx --test neon/queryParams.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { LATEST_ALLOWED, onlyParams } from "../lib/queryParams";

const q = (s: string) => new URLSearchParams(s);

test("المعاملات المعروفة مقبولة", () => {
  assert.equal(onlyParams(q("all=1"), ["all", "latest"]), true);
  assert.equal(onlyParams(q("coll=series&id=abc"), ["coll", "id"]), true);
  assert.equal(onlyParams(q(""), ["coll"]), true);
});

test("معامل وهمي أو مكرّر مرفوض", () => {
  assert.equal(onlyParams(q("all=1&x=123"), ["all"]), false);
  assert.equal(onlyParams(q("all=1&all=1"), ["all"]), false);
  assert.equal(onlyParams(q("key=site&_=1&_=2"), ["key", "_"]), false);
});

test("قيم latest التي تطلبها الواجهة مسموحة", () => {
  for (const n of [12, 50, 200]) assert.ok(LATEST_ALLOWED.includes(n));
  assert.ok(!LATEST_ALLOWED.includes(201));
});
