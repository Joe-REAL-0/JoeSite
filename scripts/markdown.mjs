/**
 * 构建期 Markdown 渲染。
 *
 * 输出与旧站（python-markdown + bleach + mdx_math）等价：
 * - 表格、围栏代码、目录 permalink、`$…$` / `$$…$$` 公式保留；
 * - 渲染结果按旧站白名单净化，正文里的 <script> 不会进入产物。
 */
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import hljs from "highlight.js";
import sanitizeHtml from "sanitize-html";

// 与旧站 app/utils.py 的 allowed_tags 一致。
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "div", "span", "hr",
  "del", "ins", "sub", "sup",
];

// 与旧站 allowed_attributes 一致，另放行 codehilite 写出的 class。
const ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  code: ["class"],
  pre: ["class"],
  div: ["class"],
  span: ["class"],
  h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
};

/**
 * 公式插件：把 $…$ / $$…$$ 包成 MathJax 可识别的节点。
 *
 * 不包裹时，公式里的 * 和 _ 会被当成强调语法吃掉；包起来后正文保持原样，
 * 由页面上的 MathJax 负责排版。公式内容始终转义输出。
 */
function mathPlugin(md) {
  const escapeHtml = md.utils.escapeHtml;

  md.block.ruler.before("fence", "math_block", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(start, max);

    if (!line.startsWith("$$")) return false;
    if (silent) return true;

    let content = line.slice(2);
    let nextLine = startLine;
    let closed = content.trimEnd().endsWith("$$");

    if (closed) {
      content = content.trimEnd().slice(0, -2);
    } else {
      const parts = [content];
      for (nextLine = startLine + 1; nextLine < endLine; nextLine += 1) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineEnd = state.eMarks[nextLine];
        const current = state.src.slice(lineStart, lineEnd);
        if (current.trimEnd().endsWith("$$")) {
          parts.push(current.trimEnd().slice(0, -2));
          closed = true;
          break;
        }
        parts.push(current);
      }
      content = parts.join("\n");
    }

    state.line = nextLine + 1;
    const token = state.push("math_block", "div", 0);
    token.block = true;
    token.content = content.trim();
    token.markup = "$$";
    return true;
  });

  md.renderer.rules.math_block = (tokens, idx) =>
    `<div class="math-display">${escapeHtml(tokens[idx].content)}</div>\n`;

  md.inline.ruler.after("escape", "math_inline", (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== "$") return false;
    if (state.src[start + 1] === "$") return false;

    for (let pos = start + 1; pos < state.posMax; pos += 1) {
      const char = state.src[pos];
      if (char === "\\") { pos += 1; continue; }
      if (char === "\n") return false;
      if (char !== "$") continue;
      if (state.src[pos + 1] === "$") return false;
      const content = state.src.slice(start + 1, pos);
      if (!content.trim()) return false;
      if (silent) return true;

      const token = state.push("math_inline", "span", 0);
      token.content = content;
      token.markup = "$";
      state.pos = pos + 1;
      return true;
    }
    return false;
  });

  md.renderer.rules.math_inline = (tokens, idx) =>
    `<span class="math-inline">${escapeHtml(tokens[idx].content)}</span>`;
}

/**
 * 标题锚点：保留中文与字母数字，空格转连字符，去掉标点。
 * 用可读 id 而不是百分号编码，目录链接与地址栏都对得上。
 */
function slugify(raw) {
  const text = String(raw).trim().toLowerCase();
  const cleaned = text
    .replace(/[\s\u3000]+/g, "-")
    .replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, "")
    .replace(/[。，、；：？！“”‘’（）《》【】…—·]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "section";
}

const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
  highlight(code, lang) {
    const language = lang && hljs.getLanguage(lang) ? lang : null;
    let inner;
    if (language) {
      try {
        inner = hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } catch {
        inner = md.utils.escapeHtml(code);
      }
    } else {
      inner = md.utils.escapeHtml(code);
    }
    const codeClass = language ? `hljs language-${language}` : "hljs";
    // 返回完整 <pre>：markdown-it 见到 <pre 开头的返回值就不再套自己的外壳。
    return `<pre class="highlight"><code class="${codeClass}">${inner}</code></pre>`;
  },
})
  .use(mathPlugin)
  .use(anchor, {
    level: [1, 2, 3, 4, 5, 6],
    slugify,
    uniqueSlugStartIndex: 2,
    permalink: anchor.permalink.linkAfterHeader({
      symbol: "#",
      placement: "after",
      class: "headerlink",
      assistiveText: (title) => `${title} 的永久链接`,
      visuallyHiddenClass: "visually-hidden",
    }),
  });

/** 把 Markdown 渲染为已净化的 HTML。 */
export function renderMarkdown(source) {
  if (!source) return "";
  return sanitizeHtml(md.render(source), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // 与 bleach strip=False 一致：丢弃标签本体，保留内部文字。
    disallowedTagsMode: "discard",
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
  });
}

/** 从已渲染正文中提取 h2/h3，生成静态目录（无 JS 也可用）。 */
export function extractToc(html) {
  const items = [];
  const pattern = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const level = match[1];
    const idMatch = /\bid="([^"]+)"/.exec(match[2]);
    if (!idMatch) continue;
    const text = match[3]
      .replace(/<a[^>]*class="headerlink"[^>]*>[\s\S]*?<\/a>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!text) continue;
    items.push({ id: idMatch[1], level, text });
  }
  return items;
}

/** 骨架、代码块、公式等纯文本摘要，用于列表页。保留旧站 clean_markdown_for_summary 的取向。 */
export function summarize(markdown, fallback = "") {
  const text = (markdown || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/\$\$?/g, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  return text || fallback;
}
