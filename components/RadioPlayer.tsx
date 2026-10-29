"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import DrivePlayer from "@/components/DrivePlayer";
import Icon from "@/components/Icon";
import { useSettings } from "@/lib/settings";

const num = new Intl.NumberFormat("ar-EG");

/** ألوان مبهجة تتناوب على أناشيد القائمة. */
const COLORS = ["#ff6b6b", "#ffb02e", "#34c759", "#22b8f0", "#a66cff", "#ff6fb5"];

/** خلط عشوائي (Fisher–Yates) لنسخة من المصفوفة. */
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** صفحة الإذاعة: مشغّل درايف في الأعلى، وتحته قائمة الأناشيد المتحرّكة. الضغط على نشيد يشغّله في المشغّل. */
export default function RadioPlayer() {
  const { settings, ready } = useSettings();
  const raw = settings.radio.items;
  // ترتيب عشوائي جديد عند كل فتح للصفحة (ويبقى ثابتًا ما دامت الأناشيد نفسها؛ تعديل عنوان نشيد لا يعيد الخلط).
  const idsKey = raw.map((x) => x.id).join(",");
  const order = useMemo(() => shuffle(idsKey ? idsKey.split(",") : []), [idsKey]);
  const items = useMemo(() => {
    const byId = new Map(raw.map((x) => [x.id, x]));
    return order.map((id) => byId.get(id)).filter((x): x is (typeof raw)[number] => Boolean(x));
  }, [raw, order]);
  const [curId, setCurId] = useState("");
  // التشغيل تلقائي عند فتح الصفحة (قد تمنعه بعض المتصفحات، وخاصة الجوال، حتى يلمس الزائر الصفحة).
  const [chosen, setChosen] = useState(true);
  const list = useRef<HTMLUListElement>(null);

  const found = items.findIndex((x) => x.id === curId);
  const idx = found >= 0 ? found : 0;
  const cur = items[idx];

  const pick = (id: string) => {
    setCurId(id);
    setChosen(true);
  };
  const step = (d: -1 | 1) => {
    const j = idx + d;
    if (j >= 0 && j < items.length) pick(items[j].id);
  };

  // يُبقي النشيد الحالي ظاهرًا داخل القائمة (تمرير داخل القائمة نفسها دون تحريك الصفحة).
  useEffect(() => {
    if (!chosen) return;
    const box = list.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !el) return;
    const top = el.offsetTop - box.offsetTop - (box.clientHeight - el.offsetHeight) / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [curId, chosen]);

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  if (items.length === 0) {
    return (
      <div className="empty">
        <h1>إذاعة</h1>
        <p>لا توجد أناشيد حاليًا، وسنضيفها قريبًا.</p>
      </div>
    );
  }

  return (
    <section className="radio" aria-labelledby="radio-h">
      <h1 id="radio-h" className="page-title">إذاعة</h1>

      <div className="radio-player">
        <DrivePlayer driveId={cur.drive} title={cur.title} hue={170} autoplay={chosen} />
        <div className="radio-now">
          <button type="button" className="radio-step" onClick={() => step(-1)} disabled={idx <= 0} aria-label="النشيد السابق" title="السابق">
            <Icon name="up" size={20} />
          </button>
          <p className="radio-title" aria-live="polite">
            <small>{num.format(idx + 1)} من {num.format(items.length)}</small>
            <strong>{cur.title}</strong>
          </p>
          <button type="button" className="radio-step" onClick={() => step(1)} disabled={idx >= items.length - 1} aria-label="النشيد التالي" title="التالي">
            <Icon name="chevdown" size={20} />
          </button>
        </div>
      </div>

      <div className="radio-glass">
        <h2 className="radio-glass-h"><span aria-hidden="true">🎵</span> أناشيدنا</h2>
        <ul className="radio-list" ref={list} aria-label="قائمة الأناشيد">
          {items.map((it, i) => {
            const on = i === idx;
            return (
              <li key={it.id} style={{ "--i": Math.min(i, 14), "--c": COLORS[i % COLORS.length] } as CSSProperties}>
                <button type="button" className={on ? "radio-item on" : "radio-item"} aria-current={on ? "true" : undefined} onClick={() => pick(it.id)}>
                  <span className="radio-n" aria-hidden="true">
                    {on ? <span className="radio-eq"><i /><i /><i /></span> : num.format(i + 1)}
                  </span>
                  <span className="radio-t">{it.title}</span>
                  <span className="radio-go" aria-hidden="true"><Icon name="play" size={18} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
