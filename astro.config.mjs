import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://merciertalentsolutions.com",
  build: {
    inlineStylesheets: "always",
  },
  integrations: [mdx(), sitemap()],
});
