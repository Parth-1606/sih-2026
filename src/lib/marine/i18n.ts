// Minimal multilingual layer: English + Hindi first, registry ready for
// Marathi, Tamil, Telugu, Malayalam, Bengali, Gujarati, Kannada, Odia.
// Dynamic values (numbers, place names) stay as-is; verdicts, risk levels
// and recommendations are translated. Preference persists in localStorage.
export type Lang = "en" | "hi" | "mr" | "ta" | "te" | "ml" | "bn" | "gu" | "kn" | "or";

export const LANGS: { code: Lang; label: string; ready: boolean }[] = [
  { code: "en", label: "English", ready: true },
  { code: "hi", label: "हिन्दी", ready: true },
  { code: "mr", label: "मराठी", ready: false },
  { code: "ta", label: "தமிழ்", ready: false },
  { code: "te", label: "తెలుగు", ready: false },
  { code: "ml", label: "മലയാളം", ready: false },
  { code: "bn", label: "বাংলা", ready: false },
  { code: "gu", label: "ગુજરાતી", ready: false },
  { code: "kn", label: "ಕನ್ನಡ", ready: false },
  { code: "or", label: "ଓଡ଼ିଆ", ready: false },
];

const D: Record<string, { en: string; hi: string }> = {
  "risk.Low": { en: "Low", hi: "कम" },
  "risk.Medium": { en: "Medium", hi: "मध्यम" },
  "risk.High": { en: "High", hi: "उच्च" },
  "risk.Severe": { en: "Severe", hi: "गंभीर" },
  "rec.Safe": { en: "Safe", hi: "सुरक्षित" },
  "rec.Safe with caution": { en: "Safe with caution", hi: "सावधानी के साथ सुरक्षित" },
  "rec.Avoid offshore travel": { en: "Avoid offshore travel", hi: "गहरे समुद्र में न जाएं" },
  "rec.Do not venture into the sea": { en: "Do not venture into the sea", hi: "समुद्र में बिल्कुल न जाएं" },
  "agent.marine-data": { en: "Marine Data", hi: "समुद्री डेटा" },
  "agent.ocean-analytics": { en: "Ocean Analytics", hi: "महासागर विश्लेषण" },
  "agent.weather-hazard": { en: "Weather & Hazards", hi: "मौसम व खतरे" },
  "agent.geospatial": { en: "Geospatial", hi: "भू-स्थानिक" },
  "agent.route": { en: "Marine Route", hi: "समुद्री मार्ग" },
  "agent.risk": { en: "Risk Assessment", hi: "जोखिम मूल्यांकन" },
  "agent.explanation": { en: "Explanation", hi: "स्पष्टीकरण" },
  "agent.visualization": { en: "Visualisation", hi: "विज़ुअलाइज़ेशन" },
  "how.title": { en: "How this answer was produced", hi: "यह उत्तर कैसे तैयार हुआ" },
  "how.intent": { en: "Intent detected", hi: "पहचाना गया इरादा" },
  "how.steps": { en: "Agent steps", hi: "एजेंट चरण" },
  "how.sources": { en: "Sources queried", hi: "पूछे गए स्रोत" },
  "how.evidence": { en: "Key evidence", hi: "मुख्य साक्ष्य" },
  "how.rules": { en: "Risk rules triggered", hi: "लागू जोखिम नियम" },
  "how.confidence": { en: "Confidence & uncertainty", hi: "विश्वास व अनिश्चितता" },
  "how.none": { en: "None", hi: "कोई नहीं" },
  "mode.live": { en: "Live", hi: "लाइव" },
  "mode.demo": { en: "Demo data", hi: "डेमो डेटा" },
  "mode.forecast": { en: "Forecast", hi: "पूर्वानुमान" },
  "mode.unavailable": { en: "Unavailable", hi: "अनुपलब्ध" },
};

export function t(lang: Lang, key: string): string {
  const e = D[key];
  if (!e) return key;
  return lang === "hi" ? e.hi : e.en;
}

/** Devanagari present → Hindi, otherwise English (extensible per language). */
export function detectLang(text: string): Lang {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

const KEY = "orca-lang";

export function getStoredLang(): Lang {
  try {
    const v = localStorage.getItem(KEY) as Lang | null;
    if (v && LANGS.some(l => l.code === v && l.ready)) return v;
  } catch { /* ssr */ }
  return "en";
}

export function storeLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch { /* ignore */ }
}
