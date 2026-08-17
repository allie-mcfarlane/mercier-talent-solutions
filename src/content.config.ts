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
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAccent: z.string().optional(),
    lede: z.string().optional(),
    primaryCta: z
      .object({
        label: z.string(),
        href: z.string(),
      })
      .optional(),
    secondaryCta: z
      .object({
        label: z.string(),
        href: z.string(),
      })
      .optional(),
    proof: z
      .array(
        z.object({
          title: z.string(),
          text: z.string(),
        }),
      )
      .optional(),
    marqueeItems: z.array(z.string()).optional(),
    approach: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        text: z.string(),
        items: z.array(z.string()),
      })
      .optional(),
    news: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
      })
      .optional(),
    firm: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        text: z.string(),
      })
      .optional(),
    team: z
      .array(
        z.object({
          eyebrow: z.string(),
          name: z.string(),
          image: z.string(),
          imageAlt: z.string(),
          paragraphs: z.array(z.string()),
          email: z.string(),
          phone: z.string(),
          linkedin: z.string(),
          credentialsEyebrow: z.string(),
          credentials: z.string(),
        }),
      )
      .optional(),
    paragraphs: z.array(z.string()).optional(),
    updated: z.string().optional(),
    formSubject: z.string().optional(),
    formName: z.string().optional(),
    includeName: z.boolean().optional(),
    requestOptions: z.array(z.string()).optional(),
    contacts: z
      .array(
        z.object({
          eyebrow: z.string().optional(),
          name: z.string(),
          email: z.string(),
          phone: z.string(),
          linkedin: z.string().optional(),
        }),
      )
      .optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    focusIntro: z.string().optional(),
    focusAreas: z
      .array(
        z.object({
          title: z.string(),
          text: z.string(),
        }),
      )
      .optional(),
    services: z
      .array(
        z.object({
          eyebrow: z.string(),
          number: z.string(),
          title: z.string(),
          text: z.string(),
          summary: z.string(),
          detail: z.string(),
          image: z.string(),
          imageAlt: z.string(),
          highlights: z
            .array(
              z.object({
                title: z.string(),
                text: z.string(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
    training: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        groups: z.array(
          z.object({
            group: z.string(),
            items: z.array(
              z.object({
                title: z.string(),
                text: z.string(),
              }),
            ),
          }),
        ),
      })
      .optional(),
    consulting: z
      .object({
        eyebrow: z.string(),
        items: z.array(z.string()),
      })
      .optional(),
  }),
});

export const collections = {
  pages,
  posts,
  "white-papers": whitePapers,
};
