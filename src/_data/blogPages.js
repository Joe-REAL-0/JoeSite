import path from "node:path";
import { loadPosts, buildPages } from "../../scripts/content.mjs";

/**
 * 博客列表分页：每页 10 篇。
 * 没有文章时仍产出第 1 页，避免 /blog/ 变成 404。
 */
export default function () {
  const posts = loadPosts(path.join(import.meta.dirname, "..", "posts"));
  return buildPages(posts);
}
