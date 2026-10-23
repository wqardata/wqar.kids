import type { Metadata } from "next";
import { LIVE_URL } from "@/lib/data";

export const metadata: Metadata = { title: "بث مباشر" };

export default function Live() {
  return (
    <div className="empty">
      <h1>بث مباشر</h1>
      {LIVE_URL ? (
        <>
          <p>يوجد بث الآن.</p>
          <a className="btn" href={LIVE_URL} target="_blank" rel="noopener noreferrer">شاهد البث</a>
        </>
      ) : (
        <p>لا يوجد بث مباشر حاليًا. تابعنا لمعرفة موعد البث القادم.</p>
      )}
    </div>
  );
}
