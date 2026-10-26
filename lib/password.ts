// بلا 0/O و1/l/I لتسهيل القراءة والنسخ.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";

function pick(set: string, rnd: Uint32Array, i: number): string {
  return set[rnd[i] % set.length];
}

/** كلمة مرور عشوائية قوية (16 حرفًا) بمولّد تشفيري، تضم أحرفًا كبيرة وصغيرة وأرقامًا ورموزًا. */
export function generateStrongPassword(length = 16): string {
  const rnd = new Uint32Array(length * 2);
  crypto.getRandomValues(rnd);
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER, rnd, 0), pick(UPPER, rnd, 1), pick(DIGITS, rnd, 2), pick(SYMBOLS, rnd, 3)];
  for (let i = 4; i < length; i++) chars.push(pick(all, rnd, i));
  // خلط (Fisher–Yates) بأرقام عشوائية مستقلة.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd[length + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
