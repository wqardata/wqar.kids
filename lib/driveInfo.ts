"use client";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { parseDriveId } from "./drive";

export type DriveInfo = { id: string; title: string | null; thumbnail: string; warning: string | null };

/** يجلب اسم ملف درايف وصورته عند لصق رابط صالح (عبر /api/drive-info). */
export function useDriveInfo(url: string, user: User | null) {
  const driveId = parseDriveId(url);
  const [info, setInfo] = useState<DriveInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || !driveId) {
      setInfo(null);
      setStatus("idle");
      setMessage("");
      return;
    }
    let off = false;
    setStatus("loading");
    setMessage("");
    const t = setTimeout(async () => {
      try {
        const token = await user.getIdToken();
        const r = await fetch(`/api/drive-info?id=${encodeURIComponent(driveId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = await r.json();
        if (off) return;
        if (!r.ok) {
          setStatus("error");
          setInfo(null);
          setMessage(j.error ?? "تعذّر جلب بيانات الملف.");
          return;
        }
        setInfo(j as DriveInfo);
        setStatus("ok");
        setMessage((j as DriveInfo).warning ?? "");
      } catch {
        if (!off) {
          setStatus("error");
          setMessage("تعذّر الاتصال. حاول مرة أخرى.");
        }
      }
    }, 350);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [driveId, user]);

  return { driveId, info, status, message };
}
