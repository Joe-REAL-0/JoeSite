import site from "../_data/site.json";
import { formatChinaDate, formatRfc822 } from "../../scripts/time.mjs";
import { readBlog } from "./blog.js";

// Both feed aliases use the same build timestamp.
const builtAt = new Date();
export const buildDate = formatChinaDate(builtAt);

export function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function feedResponse(selfPath) {
  const items = readBlog().posts.slice(0, 10).map((post) => {
    const link = escapeXml(site.url + post.url);
    const categories = post.tags.map((tag) => `\n      <category>${escapeXml(tag)}</category>`).join("");
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(post.summary)}</description>
      <pubDate>${post.publishedRfc822}</pubDate>${categories}
    </item>\n`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Joe的个人博客</title>
    <link>${escapeXml(site.url)}/blog/</link>
    <description>Joe的个人网站博客 - 技术分享与生活记录</description>
    <language>zh-CN</language>
    <lastBuildDate>${formatRfc822(builtAt)}</lastBuildDate>
    <atom:link href="${escapeXml(site.url + selfPath)}" rel="self" type="application/rss+xml"/>
${items}  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
