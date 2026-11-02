// اختبار تجميع المشاهدات (بلا شبكة ولا قاعدة): npx tsx --test neon/viewBuffer.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createViewBuffer } from "../lib/viewBuffer";

const mk = (opts = {}) => {
  const calls: Record<string, number>[] = [];
  let fail = false;
  const buf = createViewBuffer(
    async (m) => {
      if (fail) throw new Error("down");
      calls.push(Object.fromEntries(m));
    },
    { intervalMs: 1000, ...opts },
  );
  return { buf, calls, setFail: (v: boolean) => (fail = v) };
};

test("أول مشاهدة تُكتب فورًا ثم تُجمَّع الباقية حتى انتهاء الفاصل", async () => {
  const { buf, calls } = mk();
  await buf.add("a", 5_000); // مضى الفاصل منذ البداية: كتابة فورية
  assert.deepEqual(calls, [{ a: 1 }]);
  await buf.add("a", 5_100);
  await buf.add("b", 5_200);
  await buf.add("a", 5_300);
  assert.equal(calls.length, 1); // لا كتابة داخل الفاصل
  assert.equal(buf.pendingCount(), 2);
  await buf.add("c", 6_100); // انتهى الفاصل: تُكتب كل المعلّقة مع هذه
  assert.deepEqual(calls[1], { a: 2, b: 1, c: 1 });
  assert.equal(buf.pendingCount(), 0);
});

test("تجاوز الحد الأقصى للمعرّفات يُجبر الكتابة", async () => {
  const { buf, calls } = mk({ maxIds: 3 });
  await buf.add("a", 5_000);
  await buf.add("b", 5_100);
  await buf.add("c", 5_200);
  await buf.add("d", 5_300);
  assert.ok(calls.length >= 2);
  assert.deepEqual(calls[1], { b: 1, c: 1, d: 1 });
});

test("فشل الكتابة لا يرمي ولا يُضيّع الأعداد", async () => {
  const { buf, calls, setFail } = mk();
  setFail(true);
  await buf.add("a", 5_000); // يفشل بصمت
  assert.equal(calls.length, 0);
  assert.equal(buf.pendingCount(), 1);
  setFail(false);
  await buf.add("a", 6_100);
  assert.deepEqual(calls[0], { a: 2 });
});

test("flush يدويًا يكتب المعلّق", async () => {
  const { buf, calls } = mk();
  await buf.add("a", 5_000);
  await buf.add("b", 5_100);
  await buf.flush(5_200);
  assert.deepEqual(calls[1], { b: 1 });
  assert.equal(buf.pendingCount(), 0);
});
