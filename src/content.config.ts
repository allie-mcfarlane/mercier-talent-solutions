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

export const collections = {
  posts,
  "white-papers": whitePapers,
};
