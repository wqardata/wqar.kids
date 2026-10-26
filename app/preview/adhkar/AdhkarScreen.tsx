"use client";
import { useState } from "react";
import AdhkarPrompt from "@/components/AdhkarPrompt";
import AdhkarReader from "@/components/AdhkarReader";
import { ADHKAR_KINDS, type AdhkarKind } from "@/lib/adhkarCore";
import { useSettings } from "@/lib/settings";
import "../screens.css";

/**
 * شاشات الأذكار كما يراها الزائر: الإشعار المنبثق («قلتها / سأقولها الآن») ثم القارئ بملء الشاشة.
 * تُعرض داخل إطار المعاينة في لوحة التحكم، وتتبع إعدادات تبويب الأذكار قبل حفظها (يطبّقها PreviewReceiver).
 */
export default function AdhkarScreen() {
  const { settings } = useSettings();
  const ak = settings.adhkar;
  const [kind, setKind] = useState<AdhkarKind>("morning");
  const [view, setView] = useState<"prompt" | "reader">("prompt");
  const [msg, setMsg] = useState("");

  const k = ADHKAR_KINDS.find((x) => x.id === kind) ?? ADHKAR_KINDS[0];
  const items = kind === "morning" ? ak.morning : ak.evening;
  const text = kind === "morning" ? ak.morningText : ak.eveningText;

  const openReader = () => {
    if (items.length === 0) { setMsg("أضف ذكرًا واحدًا على الأقل ليعمل القارئ."); return; }
    setMsg("");
    setView("reader");
  };

  if (view === "reader") {
    return (
      <AdhkarReader
        title={k.label}
        icon={k.icon}
        items={items}
        onClose={() => setView("prompt")}
        onFinish={() => { setMsg("انتهى الزائر من القراءة: يختفي الإشعار لباقي اليوم."); setView("prompt"); }}
      />
    );
  }

  return (
    <div className="pvscreen">
      <div className="pvs-bar" role="toolbar" aria-label="خيارات المعاينة">
        <div className="range-seg" role="group" aria-label="نوع الأذكار">
          {ADHKAR_KINDS.map((x) => (
            <button key={x.id} type="button" className={x.id === kind ? "on" : undefined} aria-pressed={x.id === kind} onClick={() => { setKind(x.id); setMsg(""); }}>
              {x.icon} {x.label}
            </button>
          ))}
        </div>
        {!ak.enabled && <span className="pvs-off">الأذكار معطّلة حاليًا</span>}
      </div>

      <div className="pvscreen-note">
        <strong>هكذا يظهر إشعار {k.label}</strong>
        <span>اضغط «سأقولها الآن» لترى قارئ الأذكار بملء الشاشة، وفيه {items.length} {items.length === 1 ? "ذكر" : "أذكار"}.</span>
        {msg && <span role="status">{msg}</span>}
      </div>

      <AdhkarPrompt
        icon={k.icon}
        text={text}
        onDone={() => setMsg("«قلتها»: يختفي الإشعار لباقي اليوم.")}
        onNow={openReader}
        onLater={() => setMsg("✕: يختفي الإشعار ويعود بعد 30 دقيقة.")}
      />
    </div>
  );
}
