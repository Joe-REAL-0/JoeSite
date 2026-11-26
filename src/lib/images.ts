import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getImage } from "astro:assets";
import { srcDir } from "astro:config/server";
import type { ImageMetadata } from "astro";
import sharp from "sharp";

const rasters = import.meta.glob<ImageMetadata>(["../assets/images/**/*.{avif,jpeg,jpg,png,webp}", "!../assets/images/avatars/*"], {
  import: "default",
});
const icons = import.meta.glob<string>("../assets/images/**/*.{svg,ico}", {
  import: "default",
  query: "?url&no-inline",
});

/** Resolve a key relative to src/assets/images in Astro frontmatter. */
export async function imageUrl(key: string): Promise<string> {
  const path = `../assets/images/${key}`;
  if (icons[path]) return icons[path]();
  if (!rasters[path]) throw new Error(`Unknown site image: ${key}`);

  // Reading the imported metadata's .src directly tells Astro to retain the original.
  const [src, { hasAlpha }] = await Promise.all([
    rasters[path](),
    sharp(join(fileURLToPath(srcDir), "assets/images", key)).metadata(),
  ]);
  const image = await getImage({ src, format: hasAlpha ? "avif" : "webp", quality: hasAlpha ? 80 : 75 });
  return image.src;
}
