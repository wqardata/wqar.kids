// تقدير موقع الزائر من منطقته الزمنية (بلا إذن ولا خدمات خارجية) حين يرفض مشاركة موقعه.
// الدقة تقريبية (مستوى المدينة الكبرى): فرق عدة دقائق عن موقعه الفعلي.
const TZ: Record<string, [number, number]> = {
  "Africa/Cairo": [30.0444, 31.2357],
  "Africa/Khartoum": [15.5007, 32.5599],
  "Africa/Tripoli": [32.8872, 13.1913],
  "Africa/Tunis": [36.8065, 10.1815],
  "Africa/Algiers": [36.7538, 3.0588],
  "Africa/Casablanca": [33.5731, -7.5898],
  "Africa/Nouakchott": [18.0735, -15.9582],
  "Africa/Djibouti": [11.5721, 43.1456],
  "Africa/Mogadishu": [2.0469, 45.3182],
  "Africa/Lagos": [6.5244, 3.3792],
  "Africa/Nairobi": [-1.2921, 36.8219],
  "Africa/Johannesburg": [-26.2041, 28.0473],
  "Asia/Riyadh": [24.7136, 46.6753],
  "Asia/Aden": [15.3694, 44.191],
  "Asia/Kuwait": [29.3759, 47.9774],
  "Asia/Baghdad": [33.3152, 44.3661],
  "Asia/Qatar": [25.2854, 51.531],
  "Asia/Bahrain": [26.2285, 50.586],
  "Asia/Dubai": [25.2048, 55.2708],
  "Asia/Muscat": [23.5859, 58.4059],
  "Asia/Amman": [31.9454, 35.9284],
  "Asia/Damascus": [33.5138, 36.2765],
  "Asia/Beirut": [33.8938, 35.5018],
  "Asia/Gaza": [31.5017, 34.4668],
  "Asia/Hebron": [31.5326, 35.0998],
  "Asia/Jerusalem": [31.7683, 35.2137],
  "Asia/Tehran": [35.6892, 51.389],
  "Asia/Karachi": [24.8607, 67.0011],
  "Asia/Kolkata": [28.6139, 77.209],
  "Asia/Dhaka": [23.8103, 90.4125],
  "Asia/Jakarta": [-6.2088, 106.8456],
  "Asia/Kuala_Lumpur": [3.139, 101.6869],
  "Europe/Istanbul": [41.0082, 28.9784],
  "Europe/London": [51.5074, -0.1278],
  "Europe/Paris": [48.8566, 2.3522],
  "Europe/Berlin": [52.52, 13.405],
  "Europe/Madrid": [40.4168, -3.7038],
  "Europe/Rome": [41.9028, 12.4964],
  "Europe/Amsterdam": [52.3676, 4.9041],
  "America/New_York": [40.7128, -74.006],
  "America/Chicago": [41.8781, -87.6298],
  "America/Denver": [39.7392, -104.9903],
  "America/Los_Angeles": [34.0522, -118.2437],
  "America/Toronto": [43.6532, -79.3832],
  "Australia/Sydney": [-33.8688, 151.2093],
};

/** إحداثيات تقريبية من منطقة الجهاز الزمنية؛ وإن لم تُعرف المنطقة نستنتج خط الطول من فرق التوقيت. */
export function approxFromTimezone(date = new Date()): { lat: number; lng: number } | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hit = tz && TZ[tz];
    if (hit) return { lat: hit[0], lng: hit[1] };
    const offsetH = -date.getTimezoneOffset() / 60; // شرق + 
    return { lat: 30, lng: Math.max(-180, Math.min(180, offsetH * 15)) };
  } catch {
    return null;
  }
}
