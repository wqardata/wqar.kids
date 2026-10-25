import Icon from "./Icon";
import { avatarById } from "@/lib/avatars";

/** دائرة ملوّنة بأيقونة بيضاء (الصورة الرمزية للعضو). */
export default function Avatar({ id, size = 36 }: { id?: string | null; size?: number }) {
  const a = avatarById(id);
  return (
    <span
      aria-hidden="true"
      style={{ display: "grid", placeItems: "center", width: size, height: size, borderRadius: "50%", background: a.bg, color: "#fff", flex: "none" }}
    >
      <Icon name={a.icon} size={Math.round(size * 0.58)} />
    </span>
  );
}
