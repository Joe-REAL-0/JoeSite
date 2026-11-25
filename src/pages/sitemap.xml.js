import site from "../_data/site.json";
import { readBlog } from "../lib/blog.js";
import { buildDate, escapeXml } from "../lib/feeds.js";

function entry(path, frequency, priority, lastmod = buildDate) {
  return `  <url>
    <loc>${escapeXml(site.url + path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${frequency}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export function GET() {
  const { pages, posts } = readBlog();
  const entries = [
    entry("/", "weekly", "1.0"),
    ...pages.map((page) => entry(page.url, "daily", "0.9")),
    ...posts.map((post) => entry(post.url, "monthly", "0.8", post.updatedDate || post.createdDate)),
    entry("/oc_introduce/", "monthly", "0.7"),
    entry("/friend_link/", "weekly", "0.6"),
    entry("/cloud/", "monthly", "0.4"),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
