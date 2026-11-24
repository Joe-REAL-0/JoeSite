import path from "node:path";
import { loadOc } from "../../scripts/content.mjs";

/** 档案馆各节，顺序由 front matter 的 order 决定。 */
export default function () {
  return loadOc(path.join(import.meta.dirname, "..", "oc"));
}
