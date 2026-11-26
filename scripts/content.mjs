/**
 * 内容装载与分页规则。
 *
 * 构建只读仓库里的公开内容文件：src/posts/<id>.md、src/oc/<id>.md、src/_data/friends.json。
 * 不连数据库，不读旧站。
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { renderMarkdown, extractToc, summarize } from "./markdown.mjs";
import { parseChinaTime, formatChinaTime, formatRfc822 } from "./time.mjs";

export const POSTS_PER_PAGE = 10;

/** 列表与 RSS 共用的排序：创建时间倒序，同一时间按 ID 倒序。 */
export function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    const delta = b.createdAt.getTime() - a.createdAt.getTime();
    return delta !== 0 ? delta : b.id - a.id;
  });
}

/** 第 1 页对外地址；第 2 页起是独立路径。 */
export function pageUrl(pageNumber) {
  return pageNumber === 1 ? "/blog/" : `/blog/page/${pageNumber}/`;
}

/** 第 1 页与后续页的产物文件位置（相对输出目录）。 */
export function pageOutputPath(pageNumber) {
  return pageNumber === 1 ? "blog/index.html" : `blog/page/${pageNumber}/index.html`;
}

/** 文章详情地址：沿用旧站数字 ID，标题变更不影响地址。 */
export function postUrl(id) {
  return `/blog/${id}/`;
}

/** 详情产物位置，末尾带尾斜杠的地址可直接命中。 */
export function postOutputPath(id) {
  return `blog/${id}/index.html`;
}

/**
 * 按每页固定条数切分，并算好前后页地址。
 * 条目为 0 时仍产出第 1 页，用来生成「暂无文章」的列表页。
 */
export function buildPages(posts, perPage = POSTS_PER_PAGE) {
  if (!Number.isInteger(perPage) || perPage <= 0) {
    throw new Error(`每页条数必须是正整数，收到 ${perPage}`);
  }
  const totalPages = posts.length === 0 ? 0 : Math.ceil(posts.length / perPage);
  const pageCount = Math.max(totalPages, 1);
  const pages = [];

  for (let index = 0; index < pageCount; index += 1) {
    const number = index + 1;
    pages.push({
      number,
      posts: posts.slice(index * perPage, (index + 1) * perPage),
      totalPages,
      totalCount: posts.length,
      url: pageUrl(number),
      outputPath: pageOutputPath(number),
      prevUrl: number > 1 ? pageUrl(number - 1) : "",
      nextUrl: number < totalPages ? pageUrl(number + 1) : "",
    });
  }

  return pages;
}

function requireField(meta, field, file) {
  const value = meta[field];
  if (value === undefined || value === null || value === "") {
    throw new Error(`内容文件 ${file} 缺少必填字段 ${field}`);
  }
  return value;
}

function readFrontMatterFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const raw = fs.readFileSync(file, "utf8");
      return { file, name, raw, ...matter(raw) };
    });
}

/**
 * 读取已发布文章。
 * 缺字段、ID 重复、时间无法解析一律让构建失败，避免静默漏文。
 */
export function loadPosts(dir) {
  const seen = new Set();
  const posts = readFrontMatterFiles(dir).map(({ file, name, data, content }) => {
    const id = Number(requireField(data, "id", name));
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`内容文件 ${name} 的 id 必须是正整数，收到 ${data.id}`);
    }
    if (seen.has(id)) {
      throw new Error(`文章 ID ${id} 重复（${name}）`);
    }
    seen.add(id);

    const title = String(requireField(data, "title", name));
    const createdAt = parseChinaTime(requireField(data, "created_time", name));
    if (!createdAt) {
      throw new Error(`内容文件 ${name} 的 created_time 无法解析：${data.created_time}`);
    }

    const updatedAt = data.updated_time ? parseChinaTime(data.updated_time) : null;
    if (data.updated_time && !updatedAt) {
      throw new Error(`内容文件 ${name} 的 updated_time 无法解析：${data.updated_time}`);
    }

    const body = content;
    const html = renderMarkdown(body);
    const summary = typeof data.summary === "string" && data.summary.trim()
      ? data.summary.trim()
      : summarize(body);

    return {
      id,
      title,
      body,
      html,
      summary,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      createdAt,
      createdRaw: data.created_time,
      createdTime: formatChinaTime(data.created_time),
      createdDate: formatChinaTime(data.created_time).slice(0, 10),
      updatedTime: updatedAt ? formatChinaTime(data.updated_time) : "",
      updatedDate: updatedAt ? formatChinaTime(data.updated_time).slice(0, 10) : "",
      publishedRfc822: formatRfc822(data.created_time),
      toc: extractToc(html),
      url: postUrl(id),
      outputPath: postOutputPath(id),
      sourceFile: name,
    };
  });

  return sortPosts(posts);
}

/**
 * 读取 OC 章节：标题与排序分开，顺序由 order 决定，不从中文字面推。
 */
export function loadOc(dir) {
  const seen = new Set();
  return readFrontMatterFiles(dir)
    .map(({ name, data, content }) => {
      const id = Number(requireField(data, "id", name));
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`内容文件 ${name} 的 id 必须是正整数，收到 ${data.id}`);
      }
      if (seen.has(id)) {
        throw new Error(`OC 章节 ID ${id} 重复（${name}）`);
      }
      seen.add(id);

      const order = Number(requireField(data, "order", name));
      if (!Number.isInteger(order) || order <= 0) {
        throw new Error(`内容文件 ${name} 的 order 必须是正整数，收到 ${data.order}`);
      }

      return {
        id,
        order,
        title: String(requireField(data, "title", name)),
        anchor: `oc-${id}`,
        // 旧正文是纯文本：保留段落与换行，不当作 HTML 解析。
        paragraphs: content
          .replace(/\r\n/g, "\n")
          .split(/\n{2,}/)
          .map((block) => block.trim())
          .filter(Boolean)
          .map((block) => block.split("\n")),
      };
    })
    .sort((a, b) => (a.order === b.order ? a.id - b.id : a.order - b.id));
}

/** 友链只存图床文件名，页面使用完整的 HTTPS 地址。 */
export function loadFriends(file) {
  if (!fs.existsSync(file)) return [];

  const entries = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(entries)) {
    throw new Error(`${path.basename(file)} 必须是数组`);
  }

  return entries.map((entry, index) => {
    const name = String(entry.name ?? "").trim();
    const url = String(entry.url ?? "").trim();
    if (!name) throw new Error(`友链第 ${index + 1} 条缺少 name`);
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`友链「${name}」的网址必须是 http(s)：${url}`);
    }
    const avatar = String(entry.avatar ?? "").trim() || "default.avif";
    if (!/^[a-z\d][a-z\d-]*\.(?:webp|avif)$/i.test(avatar)) {
      throw new Error(`友链「${name}」的头像文件名无效：${avatar}`);
    }
    return {
      name,
      url,
      avatar: `https://img.furryjoe.site/avatars/${avatar}`,
    };
  });
}
