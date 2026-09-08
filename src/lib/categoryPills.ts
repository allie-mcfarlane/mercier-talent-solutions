export const CATEGORY_PILL_CLASSES = {
  Insight: "pill-insight",
  Speaking: "pill-speaking",
  "White Paper": "pill-whitepaper",
  Announcement: "pill-announcement",
  News: "pill-news",
} as const;

export type ArticleCategory = keyof typeof CATEGORY_PILL_CLASSES;

export const categoryClass = (category: string) =>
  CATEGORY_PILL_CLASSES[category as ArticleCategory] ?? CATEGORY_PILL_CLASSES.Insight;
