import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    author: z.string().default("Julia Mercier"),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    category: z.enum(["Insight", "Speaking", "White Paper", "Announcement", "News"]),
    excerpt: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
  }),
});

const whitePapers = defineCollection({
  schema: z.object({
    title: z.string(),
    number: z.string(),
    date: z.date(),
    description: z.string(),
    document: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});

const pages = defineCollection({
  schema: z.object({
    eyebrow: z.string(),
    title: z.string(),
    titleAccent: z.string(),
    lede: z.string(),
    primaryCta: z.object({
      label: z.string(),
      href: z.string(),
    }),
    secondaryCta: z.object({
      label: z.string(),
      href: z.string(),
    }),
    proof: z.array(
      z.object({
        title: z.string(),
        text: z.string(),
      }),
    ),
    marqueeItems: z.array(z.string()),
    approach: z.object({
      eyebrow: z.string(),
      title: z.string(),
      text: z.string(),
      items: z.array(z.string()),
    }),
    news: z.object({
      eyebrow: z.string(),
      title: z.string(),
    }),
  }),
});

export const collections = {
  pages,
  posts,
  "white-papers": whitePapers,
};
