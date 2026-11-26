import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import site from "./src/_data/site.json" with { type: "json" };


export default defineConfig({
  site: site.url,
  output: "static",
  integrations: [svelte()],
  vite: { build: { assetsInlineLimit: 0 } },
});
