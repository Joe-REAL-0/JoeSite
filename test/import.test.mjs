import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(import.meta.dirname, "..");
const IMPORTER = path.join(ROOT, "scripts", "import-content.mjs");

/** 造一个与旧站 database.py 表结构一致的快照。 */
function makeSnapshot(dir) {
  const dbPath = path.join(dir, "snapshot.db");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE users (email TEXT, nickname TEXT, password TEXT, avatar TEXT DEFAULT 'default_avatar.png', friend_link TEXT DEFAULT '');
    CREATE TABLE oc_introduces (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, order_id INTEGER, UNIQUE(title));
    CREATE TABLE blogs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, created_time TEXT NOT NULL, updated_time TEXT, author_email TEXT NOT NULL, is_published INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0);
    CREATE TABLE blog_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, tag_name TEXT NOT NULL UNIQUE, created_time TEXT NOT NULL);
    CREATE TABLE blog_tag_relations (blog_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (blog_id, tag_id));
  `);

  const insertBlog = db.prepare(
    "INSERT INTO blogs (id, title, content, summary, created_time, updated_time, author_email, is_published, view_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insertBlog.run(42, "已发布文章", "第一段。\n\n第二段。", "摘要", "2024-05-06 08:00:00", "2024-05-07 09:30:00", "owner@example.com", 1, 7);
  insertBlog.run(43, "草稿文章", "不该出现", "", "2024-05-08 08:00:00", null, "owner@example.com", 0, 0);

  db.exec("INSERT INTO blog_tags (id, tag_name, created_time) VALUES (1, '随笔', '2024-01-01 00:00:00')");
  db.exec("INSERT INTO blog_tag_relations (blog_id, tag_id) VALUES (42, 1)");

  db.exec("INSERT INTO oc_introduces (id, title, content, order_id) VALUES (3, '第三节', '丙', 3)");
  db.exec("INSERT INTO oc_introduces (id, title, content, order_id) VALUES (1, '第一节', '甲\n\n乙', 1)");

  db.exec("INSERT INTO users (email, nickname, password, avatar, friend_link) VALUES ('a@example.com', 'Shadow', 'secret', 'shadow.jpg', 'https://www.shadow.top')");
  db.exec("INSERT INTO users (email, nickname, password, avatar, friend_link) VALUES ('b@example.com', '裸域名', 'secret2', 'default_avatar.png', 'example.com')");
  db.exec("INSERT INTO users (email, nickname, password, avatar, friend_link) VALUES ('c@example.com', '无友链', 'secret3', 'default_avatar.png', '')");
  db.close();

  const avatars = path.join(dir, "avatars-source");
  fs.mkdirSync(avatars, { recursive: true });
  fs.writeFileSync(path.join(avatars, "shadow.jpg"), "fake-image-bytes");
  return { dbPath, avatars };
}

function runImport(args) {
  return spawnSync(process.execPath, [IMPORTER, ...args], { encoding: "utf8" });
}

test("导出：只带出公开字段，草稿与非 http(s) 友链留账不出库", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { dbPath, avatars } = makeSnapshot(dir);
  const out = path.join(dir, "out");
  const result = runImport(["--db", dbPath, "--out", out, "--avatars", avatars]);
  assert.equal(result.status, 0, result.stderr);

  // 只导出已发布文章，保留原 ID；草稿不写文件
  assert.ok(fs.existsSync(path.join(out, "posts", "42.md")));
  assert.ok(!fs.existsSync(path.join(out, "posts", "43.md")));

  const post = fs.readFileSync(path.join(out, "posts", "42.md"), "utf8");
  assert.match(post, /^id: 42$/m);
  assert.match(post, /^title: "已发布文章"$/m);
  assert.match(post, /^created_time: "2024-05-06 08:00:00"$/m);
  assert.match(post, /tags: \["随笔"\]/);
  assert.match(post, /第一段。/);
  assert.ok(!post.includes("owner@example.com"), "不得导出作者邮箱");
  assert.ok(!post.includes("view_count"));

  // OC 按 order_id 排序，文件名用数据库 id
  const ocFiles = fs.readdirSync(path.join(out, "oc")).sort();
  assert.deepEqual(ocFiles, ["1.md", "3.md"]);
  assert.match(fs.readFileSync(path.join(out, "oc", "1.md"), "utf8"), /^order: 1$/m);

  // 友链：只保留可公开的字段，头像文件随条目复制
  const friends = JSON.parse(fs.readFileSync(path.join(out, "friends.json"), "utf8"));
  assert.deepEqual(friends, [{ name: "Shadow", url: "https://www.shadow.top", avatar: "/images/avatars/shadow.jpg" }]);
  assert.ok(fs.existsSync(path.join(out, "avatars", "shadow.jpg")));

  const serialized = JSON.stringify(friends);
  for (const secret of ["secret", "example.com", "password"]) {
    assert.ok(!serialized.includes(secret), `友链不应带出 ${secret}`);
  }

  // 私有对账表：记录排除项与逐篇校验值
  const report = JSON.parse(fs.readFileSync(path.join(out, "reconciliation.private.json"), "utf8"));
  assert.equal(report.posts.published, 1);
  assert.equal(report.posts.draftsExcluded, 1);
  assert.deepEqual(report.posts.ids, [42]);
  assert.match(report.posts.hashes["42"], /^[a-f0-9]{64}$/);
  assert.deepEqual(report.friends.rejected.map((item) => item.name), ["裸域名"]);
  assert.deepEqual(report.urls, [{ old: "/blog/42", new: "/blog/42/" }]);
});

test("导出：目标目录非空时拒绝执行，避免覆盖已审核内容", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-nonempty-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { dbPath } = makeSnapshot(dir);
  const out = path.join(dir, "out");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "existing.md"), "人工改过的内容");

  const result = runImport(["--db", dbPath, "--out", out]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /目标目录非空/);
  assert.equal(fs.readFileSync(path.join(out, "existing.md"), "utf8"), "人工改过的内容");
});

test("导出：缺头像回到默认图并留记录", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-missing-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { dbPath, avatars } = makeSnapshot(dir);
  fs.rmSync(path.join(avatars, "shadow.jpg"));

  const out = path.join(dir, "out");
  assert.equal(runImport(["--db", dbPath, "--out", out, "--avatars", avatars]).status, 0);

  const friends = JSON.parse(fs.readFileSync(path.join(out, "friends.json"), "utf8"));
  assert.equal(friends[0].avatar, "/images/avatars/default_avatar.png");
  const report = JSON.parse(fs.readFileSync(path.join(out, "reconciliation.private.json"), "utf8"));
  assert.deepEqual(report.friends.missingAvatars.map((item) => item.name), ["Shadow"]);
});

test("导出：产物能被构建直接读取（front matter 合法）", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-build-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { dbPath, avatars } = makeSnapshot(dir);
  const out = path.join(dir, "out");
  assert.equal(runImport(["--db", dbPath, "--out", out, "--avatars", avatars]).status, 0);

  const projectDir = path.join(ROOT, `.tmp-import-${process.pid}-${Date.now()}`);
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  fs.mkdirSync(projectDir);
  fs.copyFileSync(path.join(ROOT, "astro.config.mjs"), path.join(projectDir, "astro.config.mjs"));
  fs.copyFileSync(path.join(ROOT, "package.json"), path.join(projectDir, "package.json"));
  fs.cpSync(path.join(ROOT, "scripts"), path.join(projectDir, "scripts"), { recursive: true });
  fs.cpSync(path.join(ROOT, "src"), path.join(projectDir, "src"), { recursive: true });

  for (const name of fs.readdirSync(path.join(projectDir, "src", "posts"))) {
    if (name.endsWith(".md")) fs.rmSync(path.join(projectDir, "src", "posts", name));
  }
  for (const name of fs.readdirSync(path.join(out, "posts"))) {
    fs.copyFileSync(path.join(out, "posts", name), path.join(projectDir, "src", "posts", name));
  }
  fs.symlinkSync(path.join(ROOT, "static"), path.join(projectDir, "static"), "junction");

  const built = spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules", "astro", "bin", "astro.mjs"), "build"],
    { cwd: projectDir, encoding: "utf8" },
  );
  assert.equal(built.status, 0, built.stderr);

  const detail = fs.readFileSync(path.join(projectDir, "dist", "blog", "42", "index.html"), "utf8");
  assert.match(detail, /已发布文章/);
  assert.match(detail, /第一段。/);
  assert.match(detail, /发布于: 2024-05-06 08:00:00/);
});
