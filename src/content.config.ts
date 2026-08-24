import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string().default("Julia Mercier"),
    authorTitle: z.string().default("Principal"),
    authorImage: z.string().optional(),
    authorImageAlt: z.string().optional(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    category: z.enum(["Insight", "Speaking", "White Paper", "Announcement", "News"]),
    excerpt: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    references: z
      .array(
        z.object({
          text: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
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
    rolesHeading: z.string().optional(),
    roles: z
      .array(
        z.object({
          title: z.string(),
          slug: z.string(),
          location: z.string().optional(),
          employmentType: z.string().optional(),
          summary: z.string().optional(),
          description: z.array(z.string()).default([]),
        }),
      )
      .optional(),
    pageBuilder: z.boolean().optional(),
    slug: z.string().optional(),
    navTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    sections: z.array(z.record(z.unknown())).optional(),
    visualStyles: z.record(z.record(z.unknown())).optional(),
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
        items: z.array(
          z.union([
            z.string(),
            z.object({
              title: z.string(),
              text: z.string(),
            }),
          ]),
        ),
      })
      .optional(),
  }),
});

const settings = defineCollection({
  schema: z.object({
    accentColor: z.string().default("#45628e"),
    darkColor: z.string().default("#1a2b46"),
    bodyTextColor: z.string().default("#2b3036"),
    mutedTextColor: z.string().default("#66707c"),
    bodyFontSize: z.number().min(14).max(22).default(16),
    pageTitleSize: z.enum(["default", "smaller", "larger"]).default("default"),
    sectionTitleSize: z.enum(["default", "smaller", "larger"]).default("default"),
  }),
});

const navigation = defineCollection({
  schema: z.object({
    items: z.array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    ),
  }),
});

export const collections = {
  pages,
  posts,
  "white-papers": whitePapers,
  settings,
  navigation,
};