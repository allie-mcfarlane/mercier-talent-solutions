import { getCollection } from "astro:content";

const normalize = (entry: any) => ({
  slug: entry.slug,
  data: entry.data,
  body: entry.body ?? "",
});

export async function GET() {
  const [pages, posts, whitepapers] = await Promise.all([
    getCollection("pages"),
    getCollection("posts"),
    getCollection("white-papers"),
  ]);

  return new Response(
    JSON.stringify({
      pages: pages.map(normalize),
      posts: posts.map(normalize),
      whitepapers: whitepapers.map(normalize),
      generatedAt: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    },
  );
}
