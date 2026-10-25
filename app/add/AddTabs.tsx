"use client";
import { useState } from "react";
import AddVideoForm from "./AddVideoForm";
import FolderImport from "./FolderImport";

/** تبديل بين إضافة فيديو واحد واستيراد مجلد كامل. */
export default function AddTabs() {
  const [tab, setTab] = useState<"one" | "folder">("one");
  return (
    <>
      <div role="tablist" aria-label="طريقة الإضافة" className="tabs">
        <button type="button" role="tab" id="add-tab-one" aria-selected={tab === "one"} aria-controls="add-panel" className={tab === "one" ? "tab on" : "tab"} onClick={() => setTab("one")}>فيديو واحد</button>
        <button type="button" role="tab" id="add-tab-folder" aria-selected={tab === "folder"} aria-controls="add-panel" className={tab === "folder" ? "tab on" : "tab"} onClick={() => setTab("folder")}>استيراد مجلد من درايف</button>
      </div>
      <div id="add-panel" role="tabpanel" aria-labelledby={tab === "one" ? "add-tab-one" : "add-tab-folder"}>
        {tab === "one" ? <AddVideoForm /> : <FolderImport />}
      </div>
    </>
  );
}
