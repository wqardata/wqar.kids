"use client";
import { useEffect, useState } from "react";
import { clearVideoCache } from "@/lib/videos";
import AddVideoForm from "./AddVideoForm";
import FolderImport from "./FolderImport";
import AddYouTubeForm from "./AddYouTubeForm";

/** تبديل بين إضافة فيديو واحد واستيراد مجلد كامل. */
export default function AddTabs() {
  const [tab, setTab] = useState<"one" | "folder" | "youtube">("one");
  // ما أُضيف هنا يجب أن يظهر في الرئيسية فورًا: نمسح التخزين المؤقت عند مغادرة الصفحة.
  useEffect(() => () => clearVideoCache(), []);
  return (
    <>
      <div role="tablist" aria-label="طريقة الإضافة" className="tabs">
        <button type="button" role="tab" id="add-tab-one" aria-selected={tab === "one"} aria-controls="add-panel" className={tab === "one" ? "tab on" : "tab"} onClick={() => setTab("one")}>فيديو واحد</button>
        <button type="button" role="tab" id="add-tab-folder" aria-selected={tab === "folder"} aria-controls="add-panel" className={tab === "folder" ? "tab on" : "tab"} onClick={() => setTab("folder")}>استيراد مجلد من درايف</button>
        <button type="button" role="tab" id="add-tab-youtube" aria-selected={tab === "youtube"} aria-controls="add-panel" className={tab === "youtube" ? "tab on" : "tab"} onClick={() => setTab("youtube")}>رابط يوتيوب</button>
      </div>
      <div id="add-panel" role="tabpanel" aria-labelledby={`add-tab-${tab}`}>
        {tab === "one" ? <AddVideoForm /> : tab === "folder" ? <FolderImport /> : <AddYouTubeForm />}
      </div>
    </>
  );
}
