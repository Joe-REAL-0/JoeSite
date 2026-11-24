import path from "node:path";
import { loadPosts } from "../../scripts/content.mjs";

/** 已发布文章，按创建时间倒序。 */
export default function () {
  return loadPosts(path.join(import.meta.dirname, "..", "posts"));
}
