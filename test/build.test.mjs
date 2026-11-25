import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * 在临时目录里复制一份可构建的工程骨架（配置、内容装载脚本、src 目录），
 * static 用 junction 指回原仓库，避免复制几 MB 资源。
 * 这样测的就是真实构建，不是模拟。
 */
function makeFixtureProject(posts) {
  const dir = fs.mkdtempSync(path.join(ROOT, ".tmp-build-"));

  fs.copyFileSync(path.join(ROOT, "astro.config.mjs"), path.join(dir, "astro.config.mjs"));
  fs.copyFileSync(path.join(ROOT, "package.json"), path.join(dir, "package.json"));
  fs.cpSync(path.join(ROOT, "scripts"), path.join(dir, "scripts"), { recursive: true });
  fs.cpSync(path.join(ROOT, "src"), path.join(dir, "src"), { recursive: true });

  // 清掉样例文章，换成 fixture
  for (const name of fs.readdirSync(path.join(dir, "src", "posts"))) {
    if (name.endsWith(".md")) fs.rmSync(path.join(dir, "src", "posts", name));
  }
  for (const post of posts) {
    const body = [
      "---",
      `id: ${post.id}`,
      `title: "${post.title}"`,
      `created_time: "${post.created}"`,
      "---",
      "",
      post.body ?? `第 ${post.id} 篇正文`,
      "",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "src", "posts", `${post.id}.md`), body, "utf8");
  }

  fs.symlinkSync(path.join(ROOT, "static"), path.join(dir, "static"), "junction");
  return dir;
}

function build(projectDir) {
  const result = spawnSync(process.execPath, [path.join(ROOT, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  return result;
}

function read(dist, relative) {
  return fs.readFileSync(path.join(dist, relative), "utf8");
}

function exists(dist, relative) {
  return fs.existsSync(path.join(dist, relative));
}

const makePosts = (count) => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  title: `样例文章 ${index + 1}`,
  // 越靠后的 id 越新，列表第一条应是最大 id
  created: `2024-01-${String(index + 1).padStart(2, "0")} 10:00:00`,
}));

test("构建：11 篇分成两页，第二页独立路径且第一页有 10 张卡片", (t) => {
  const projectDir = makeFixtureProject(makePosts(11));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  const dist = path.join(projectDir, "dist");
  const result = build(projectDir);
  assert.equal(result.status, 0, result.stderr);

  assert.ok(exists(dist, "blog/index.html"));
  assert.ok(exists(dist, "blog/page/2/index.html"));
  assert.ok(!exists(dist, "blog/page/3/index.html"), "不存在的页码不应生成文件");

  const page1 = read(dist, "blog/index.html");
  const page2 = read(dist, "blog/page/2/index.html");

  assert.equal((page1.match(/blog-card-link/g) ?? []).length, 10);
  assert.equal((page2.match(/blog-card-link/g) ?? []).length, 1);
  assert.match(page1, /共 11 篇文章/);
  assert.match(page1, /第 1 \/ 2 页/);
  assert.match(page2, /第 2 \/ 2 页/);

  // 每篇都有独立详情页，地址沿用数字 ID
  for (let id = 1; id <= 11; id += 1) {
    assert.ok(exists(dist, `blog/${id}/index.html`), `缺少 /blog/${id}/`);
  }

  // 列表顺序：创建时间倒序
  const order = [...page1.matchAll(/href="\/blog\/(\d+)\/"/g)].map((m) => Number(m[1]));
  assert.deepEqual(order.slice(0, 3), [11, 10, 9]);
});

test("构建：没有文章时仍有 /blog/ 列表页，且不生成详情与分页", (t) => {
  const projectDir = makeFixtureProject([]);
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  const dist = path.join(projectDir, "dist");
  const result = build(projectDir);
  assert.equal(result.status, 0, result.stderr);

  assert.ok(exists(dist, "blog/index.html"));
  assert.match(read(dist, "blog/index.html"), /暂无博客文章/);
  assert.ok(!exists(dist, "blog/page/2/index.html"));

  const rss = read(dist, "rss.xml");
  assert.equal((rss.match(/<item>/g) ?? []).length, 0);
});

test("构建：产物不含模板残留，也没有站内写接口调用", (t) => {
  const projectDir = makeFixtureProject(makePosts(1));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  const dist = path.join(projectDir, "dist");
  assert.equal(build(projectDir).status, 0);

  const htmlFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|xml|txt)$/.test(entry.name)) htmlFiles.push(full);
    }
  };
  walk(dist);

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert.ok(!content.includes("{{"), `${file} 有未渲染的模板表达式`);
    assert.ok(!content.includes("{%"), `${file} 有未渲染的模板标签`);
    for (const banned of ["/get_resources", "/find_text", "/api/", "/self_diary", "url_for"]) {
      assert.ok(!content.includes(banned), `${file} 仍引用 ${banned}`);
    }
  }
});

test("构建：站点地图与订阅只含公开地址，且指向正式域名", (t) => {
  const projectDir = makeFixtureProject(makePosts(12));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  const dist = path.join(projectDir, "dist");
  assert.equal(build(projectDir).status, 0);

  const sitemap = read(dist, "sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0);
  for (const loc of locs) {
    assert.ok(loc.startsWith("https://furryjoe.site/"), `非正式域名：${loc}`);
  }
  assert.equal(new Set(locs).size, locs.length, "站点地图地址不应重复");
  assert.ok(locs.includes("https://furryjoe.site/blog/42/".replace("42", "12")));
  assert.ok(locs.includes("https://furryjoe.site/blog/page/2/"), "第 2 页要进站点地图");
  assert.ok(!locs.some((loc) => loc.includes("self_diary")));

  assert.match(read(dist, "robots.txt"), /Sitemap: https:\/\/furryjoe\.site\/sitemap\.xml/);

  const rss = read(dist, "rss.xml");
  const feed = read(dist, "feed.xml");
  assert.equal((rss.match(/<item>/g) ?? []).length, 10, "订阅只保留最新 10 篇");
  assert.equal(rss.replace(/\/rss\.xml/g, ""), feed.replace(/\/feed\.xml/g, ""), "两个订阅地址内容一致");
  assert.match(rss, /<guid isPermaLink="true">https:\/\/furryjoe\.site\/blog\/12\/<\/guid>/);
});

test("构建：禁用 JS 的退路样式与真链接都在产物里", (t) => {
  const projectDir = makeFixtureProject(makePosts(1));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  const dist = path.join(projectDir, "dist");
  assert.equal(build(projectDir).status, 0);

  const home = read(dist, "index.html");
  assert.match(home, /<html lang="zh-CN" class="no-js">/);
  assert.match(home, /href="\/oc_introduce\/"/);
  assert.match(home, /href="\/blog\/"/);
  assert.match(home, /href="\/friend_link\/"/);
  assert.match(home, /href="\/cloud\/"/);

  const css = read(dist, "css/global.css");
  assert.match(css, /html\.no-js #cover \{ display: none; \}/);

  const oc = read(dist, "oc_introduce/index.html");
  assert.match(oc, /href="#oc-1"/, "档案目录是无 JS 也能用的锚点链接");
  assert.equal((oc.match(/<section id="oc-/g) ?? []).length, 7, "七节档案全部在正文里");
});
