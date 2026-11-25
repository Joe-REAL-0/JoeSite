import path from "node:path";
import { loadPosts, buildPages } from "../../scripts/content.mjs";

let cached;
export function readBlog() {
  if (cached) return cached;
  const posts = loadPosts(path.join(process.cwd(), "src", "posts"));
  const blog = { posts, pages: buildPages(posts) };
  if (import.meta.env.PROD) cached = blog;
  return blog;
}
