"use client";
import { useSettings } from "@/lib/settings";

export default function LiveSection() {
  const { settings } = useSettings();
  return settings.liveUrl ? (
    <>
      <p>يوجد بث الآن.</p>
      <a className="btn" href={settings.liveUrl} target="_blank" rel="noopener noreferrer">شاهد البث</a>
    </>
  ) : (
    <p>لا يوجد بث مباشر حاليًا. تابعنا لمعرفة موعد البث القادم.</p>
  );
}
