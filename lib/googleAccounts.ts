// اقتراح حساب جوجل الموجود في المتصفح (Google Identity Services / One Tap) لملء البريد تلقائيًا عند التسجيل.
// لا يسجّل الدخول ولا يرسل شيئًا لخادمنا: نقرأ البريد والاسم من بطاقة الهوية التي يمنحها المتصفح للصفحة فقط.
// المتصفح لا يكشف بريد الزائر لأي موقع دون هذا الإذن، وهذه هي الطريقة الرسمية الوحيدة لاقتراحه.
// يتطلب NEXT_PUBLIC_GOOGLE_CLIENT_ID (انظر .env.example)؛ بدونه يعتمد الموقع على الملء التلقائي للمتصفح.

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type GisWindow = Window & {
  google?: {
    accounts: {
      id: {
        initialize: (c: Record<string, unknown>) => void;
        prompt: () => void;
        cancel: () => void;
      };
    };
  };
};

let loading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as GisWindow).google?.accounts) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("gis-load-failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

function decodeJwtPayload(jwt: string): { email?: string; name?: string } | null {
  try {
    const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** يعرض نافذة اختيار حساب جوجل؛ عند اختياره يستدعي onPick بالبريد والاسم. يعيد false إن لم تُضبط الميزة. */
export async function suggestGoogleAccount(onPick: (p: { email: string; name: string }) => void): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return false;
  try {
    await loadGis();
    const gis = (window as GisWindow).google?.accounts.id;
    if (!gis) return false;
    gis.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      callback: (r: { credential?: string }) => {
        const p = r.credential ? decodeJwtPayload(r.credential) : null;
        if (p?.email) onPick({ email: p.email, name: p.name ?? "" });
      },
    });
    gis.prompt();
    return true;
  } catch {
    return false;
  }
}

export function cancelGoogleSuggestion() {
  try {
    (window as GisWindow).google?.accounts.id.cancel();
  } catch {
    /* لا شيء */
  }
}
