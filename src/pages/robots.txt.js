import site from "../_data/site.json";

export function GET() {
  return new Response(`User-agent: *
Allow: /

# Sitemap位置
Sitemap: ${site.url}/sitemap.xml
`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
