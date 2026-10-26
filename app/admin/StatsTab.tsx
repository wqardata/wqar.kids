"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { fetchDaily, fetchTotals, type DayPoint, type SiteTotals } from "@/lib/stats";
import { MovableSection } from "./sectionKit";

const nf = new Intl.NumberFormat("ar-u-nu-latn");
const RANGES = [7, 30, 90] as const;

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" }) {
  return (
    <div className={tone === "warn" ? "stat-tile stat-tile--warn" : "stat-tile"}>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
      {note && <small className="stat-note">{note}</small>}
    </div>
  );
}

/** مخطط أعمدة بسيط (SVG) لمشاهدات كل يوم. */
function TrafficChart({ data }: { data: DayPoint[] }) {
  const W = 640;
  const H = 200;
  const PAD = { t: 12, r: 8, b: 26, l: 40 };
  const max = Math.max(1, ...data.map((d) => d.views));
  // سقف محور مرتّب (1, 2, 5 × 10^n) كي تكون الخطوط الأفقية أرقامًا مقروءة.
  const pow = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= max) ?? max;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const bw = iw / data.length;
  const ticks = [0, 0.5, 1].map((f) => Math.round(top * f));
  const every = Math.ceil(data.length / 6);
  const total = data.reduce((s, d) => s + d.views, 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stat-chart" role="img" aria-label={`مخطط المشاهدات اليومية، المجموع ${nf.format(total)}`} direction="ltr">
      {ticks.map((t) => {
        const y = PAD.t + ih - (t / top) * ih;
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="stat-grid" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" className="stat-axis">{nf.format(t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.views / top) * ih;
        const x = PAD.l + i * bw;
        return (
          <g key={d.day}>
            <rect x={x + bw * 0.15} y={PAD.t + ih - h} width={Math.max(1, bw * 0.7)} height={h} rx={Math.min(3, bw * 0.35)} className="stat-bar">
              <title>{`${new Date(d.day).toLocaleDateString("ar", { dateStyle: "medium", timeZone: "UTC" })}: ${nf.format(d.views)} مشاهدة`}</title>
            </rect>
            {i % every === 0 && (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="stat-axis">
                {new Date(d.day).toLocaleDateString("ar", { day: "numeric", month: "numeric", timeZone: "UTC" })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function StatsTab() {
  const [totals, setTotals] = useState<SiteTotals | null>(null);
  const [daily, setDaily] = useState<DayPoint[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [loading, setLoading] = useState(true);
  const [totalsErr, setTotalsErr] = useState("");
  const [dailyErr, setDailyErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setTotalsErr("");
    setDailyErr("");
    // كل جزء مستقل: فشل مخطط الإقبال (القواعد القديمة مثلًا) لا يُخفي المجاميع.
    const a = fetchTotals().then(setTotals).catch(() => setTotalsErr("تعذّر حساب المجاميع."));
    const b = fetchDaily(90).then(setDaily).catch(() => setDailyErr("تعذّر تحميل مخطط الإقبال. حدّث قواعد Firestore (stats) ثم Publish."));
    void Promise.all([a, b]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shownDaily = useMemo(() => daily.slice(-range), [daily, range]);
  const sumOf = (n: number) => daily.slice(-n).reduce((s, d) => s + d.views, 0);
  const rangeTotal = shownDaily.reduce((s, d) => s + d.views, 0);
  const noData = !dailyErr && daily.every((d) => d.views === 0);
  const f = (n: number | undefined) => (n === undefined ? "…" : nf.format(n));

  const openReports = totals ? totals.reportsOpen : null;

  return (
    <>
      <MovableSection id="stats.tiles">
      <div className="stats">
      <div className="stats-head">
        <h2>نظرة عامة</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
          {loading ? "جارٍ التحديث…" : "تحديث"}
        </button>
      </div>

      {totalsErr && <p className="field-error" role="alert">{totalsErr}</p>}

      <div className="stat-grid2">
        <Tile label="إجمالي المشاهدات" value={f(totals?.views)} note="مجموع مشاهدات كل الفيديوهات" />
        <Tile label="عدد الفيديوهات" value={f(totals?.videos)} note={totals && totals.hidden > 0 ? `منها ${nf.format(totals.hidden)} مخفي` : undefined} />
        <Tile label="مشاهدات اليوم" value={dailyErr ? "—" : f(sumOf(1))} note="منذ تفعيل المخطط" />
        <Tile label="مشاهدات آخر 7 أيام" value={dailyErr ? "—" : f(sumOf(7))} />
        <Tile label="المقاطع القصيرة" value={f(totals?.shorts)} />
        <Tile label="الإعجابات" value={f(totals?.likes)} />
        <Tile label="بلاغات جديدة" value={openReports === null ? "…" : nf.format(openReports)} tone={openReports ? "warn" : undefined} note={openReports ? "تحتاج مراجعة" : undefined} />
        <Tile label={`مشاهدات آخر ${range} يومًا`} value={dailyErr ? "—" : f(rangeTotal)} />
      </div>
      </div>
      </MovableSection>

      <MovableSection id="stats.chart">
      <div className="stats">
      <div className="stat-grid2">
        <section className="stat-card stat-card--full" aria-label="مخطط الإقبال">
          <div className="stats-head">
            <h3><Icon name="eye" size={16} /> الإقبال اليومي</h3>
            <div className="range-seg" role="group" aria-label="المدة">
              {RANGES.map((r) => (
                <button key={r} type="button" className={r === range ? "on" : undefined} aria-pressed={r === range} onClick={() => setRange(r)}>
                  {r} يومًا
                </button>
              ))}
            </div>
          </div>
          {dailyErr ? (
            <p className="field-error" role="alert">{dailyErr}</p>
          ) : (
            <>
              <TrafficChart data={shownDaily} />
              {noData && <p className="hint">لا توجد بيانات بعد — يبدأ التسجيل اليومي من أول مشاهدة بعد نشر هذا التحديث، ولا يشمل المشاهدات السابقة.</p>}
            </>
          )}
        </section>
      </div>
      </div>
      </MovableSection>
    </>
  );
}
