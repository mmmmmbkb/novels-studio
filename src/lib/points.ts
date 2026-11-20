// ── نظام النقاط والمستويات ───────────────────────────────────────────
// نشر فصل +50 · فصل جديد +10 · +5 لكل 500 كلمة · +2 لكل تفاعل · +5 لكل تعليق

export const POINTS = {
  PUBLISH: 50,
  CHAPTER_CREATED: 10,
  WORDS_PER_500: 5,
  REACTION: 2,
  COMMENT: 5,
} as const;

export const LEVELS = [
  { level: 1, min: 0, title: 'كاتب مبتدئ' },
  { level: 2, min: 100, title: 'كاتب واعد' },
  { level: 3, min: 300, title: 'راوٍ متمكن' },
  { level: 4, min: 600, title: 'حكّاء محترف' },
  { level: 5, min: 1000, title: 'أستاذ الرواية' },
  { level: 6, min: 1500, title: 'أسطورة ميراكس' },
];

export function levelFor(points: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) current = l;
  const next = LEVELS.find((l) => l.min > points);
  return { current, next, progress: next ? (points - current.min) / (next.min - current.min) : 1 };
}

export function countWords(text: string): number {
  const t = (text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function wordsPoints(wordCount: number): number {
  return Math.floor(wordCount / 500) * POINTS.WORDS_PER_500;
}
