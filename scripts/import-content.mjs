#!/usr/bin/env node
/**
 * 从旧站只读快照导出公开内容。
 *
 * 用法：
 *   node scripts/import-content.mjs --db <snapshot.db> --out <目录> [--avatars <头像目录>]
 *
 * 规则（对应 STATIC_MIGRATION_PLAN.md 第 3 节）：
 * - 只读打开快照，不写入、不建表；不用会自动升级表结构的旧 Database 类。
 * - 只导出 is_published = 1 的文章，保留原 ID、正文与时间。
 * - 只导出公开字段：文章不带 author_email；友链只取昵称、网址、头像。
 * - 目标目录必须为空，保证可重复导出而不覆盖既有内容。
 * - 生成私有对账表，记录数量、排除项与逐篇正文校验值。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { prepareAvatar } from "./avatars.mjs";

const DEFAULT_AVATAR = "default_avatar.png";

function fail(message) {
  console.error(`导出中止：${message}`);
  process.exit(1);
}

function parseCli() {
  const { values } = parseArgs({
    options: {
      db: { type: "string" },
      out: { type: "string" },
      avatars: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log("用法: node scripts/import-content.mjs --db <snapshot.db> --out <目录> [--avatars <头像目录>]");
    process.exit(0);
  }
  if (!values.db || !values.out) fail("缺少 --db 或 --out");

  return { db: path.resolve(values.db), out: path.resolve(values.out), avatars: values.avatars ? path.resolve(values.avatars) : null };
}

/** LF 归一后的正文校验值，用来证明导出没有改动正文。 */
function bodyHash(text) {
  return crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function assertEmptyDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  if (fs.readdirSync(dir).length > 0) {
    fail(`目标目录非空：${dir}（导出要写进空目录，避免覆盖已审核内容）`);
  }
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function exportPosts(db, outDir, report) {
  const rows = db.prepare(
    "SELECT id, title, content, summary, created_time, updated_time, is_published FROM blogs WHERE is_published = 1 ORDER BY created_time DESC, id DESC",
  ).all();
  const countAll = db.prepare("SELECT COUNT(*) AS n FROM blogs").get().n;
  const countDrafts = db.prepare("SELECT COUNT(*) AS n FROM blogs WHERE is_published = 0").get().n;

  report.posts = {
    published: rows.length,
    draftsExcluded: countDrafts,
    allRows: countAll,
    ids: [],
    hashes: {},
    emptyBodies: [],
  };

  const tagStmt = db.prepare(
    "SELECT t.tag_name FROM blog_tags t JOIN blog_tag_relations r ON r.tag_id = t.id WHERE r.blog_id = ? ORDER BY t.tag_name",
  );

  for (const row of rows) {
    const tags = tagStmt.all(row.id).map((t) => t.tag_name);
    const content = String(row.content ?? "").replace(/\r\n/g, "\n");
    if (!content.trim()) report.posts.emptyBodies.push(row.id);

    const front = [
      "---",
      `id: ${row.id}`,
      `title: ${yamlString(row.title ?? "")}`,
      `summary: ${yamlString(row.summary ?? "")}`,
      `created_time: ${yamlString(row.created_time ?? "")}`,
      row.updated_time ? `updated_time: ${yamlString(row.updated_time)}` : "",
      tags.length ? `tags: [${tags.map((t) => yamlString(t)).join(", ")}]` : "tags: []",
      "---",
      "",
      content,
      "",
    ].filter((line, index) => !(index === 5 && line === ""));

    fs.writeFileSync(path.join(outDir, `${row.id}.md`), front.join("\n"), "utf8");
    report.posts.ids.push(row.id);
    report.posts.hashes[row.id] = bodyHash(content);
    report.urls.push({ old: `/blog/${row.id}`, new: `/blog/${row.id}/` });
  }
}

function exportOc(db, outDir, report) {
  const rows = db.prepare(
    "SELECT id, title, content, order_id FROM oc_introduces ORDER BY order_id, id",
  ).all();

  report.oc = { count: rows.length, entries: [], emptyBodies: [] };

  rows.forEach((row, index) => {
    const content = String(row.content ?? "").replace(/\r\n/g, "\n").trim();
    if (!content) report.oc.emptyBodies.push(row.id);
    const order = Number(row.order_id) || index + 1;

    const document = [
      "---",
      `id: ${row.id}`,
      `title: ${yamlString(row.title ?? "")}`,
      `order: ${order}`,
      "---",
      "",
      content,
      "",
    ].join("\n");

    fs.writeFileSync(path.join(outDir, `${row.id}.md`), document, "utf8");
    report.oc.entries.push({ id: row.id, order, title: row.title, hash: bodyHash(content) });
  });
}

async function exportFriends(db, avatarsDir, report, out) {
  const outputAvatarDir = path.join(out, "avatars");
  const reviewDir = path.join(out, "avatars-review.private");
  const hasOAuth = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'oauth_accounts'").get();
  const lookup = hasOAuth && db.prepare(`
    SELECT CASE WHEN json_valid(profile_json) THEN json_extract(profile_json, '$.login') END AS login
    FROM oauth_accounts WHERE provider = 'github' AND email = ?
  `);
  const rows = db.prepare(
    "SELECT email, nickname, friend_link, avatar FROM users WHERE friend_link IS NOT NULL AND friend_link != '' ORDER BY nickname",
  ).all();

  const friends = [];
  report.friends = { candidates: rows.length, exported: 0, missingAvatars: [], reviewAvatars: [], rejected: [] };
  let defaultFilename;

  for (const row of rows) {
    const url = String(row.friend_link ?? "").trim();
    if (!/^https?:\/\//i.test(url)) {
      // 旧站允许裸域名，这里不做猜测：交给站主确认后手改 JSON。
      report.friends.rejected.push({ name: row.nickname, reason: "网址不是 http(s)，需人工确认", url });
      continue;
    }

    const avatar = String(row.avatar ?? "").trim();
    let avatarKey;

    if (avatar && avatar !== DEFAULT_AVATAR) {
      const source = avatarsDir && path.join(avatarsDir, avatar);
      if (source && path.win32.basename(avatar) === avatar && fs.lstatSync(source, { throwIfNoEntry: false })?.isFile()) {
        const accounts = lookup?.all(row.email) ?? [];
        const login = accounts.length === 1 ? accounts[0].login : null;
        if (typeof login === "string" && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login) && !login.includes("--") && login.toLowerCase() !== "default") {
          avatarKey = await prepareAvatar(source, outputAvatarDir, login);
        } else {
          fs.mkdirSync(reviewDir, { recursive: true });
          fs.copyFileSync(source, path.join(reviewDir, avatar));
          report.friends.reviewAvatars.push({ name: row.nickname, url, file: `avatars-review.private/${avatar}` });
        }
      } else {
        report.friends.missingAvatars.push({ name: row.nickname, avatar });
      }
    }
    if (!avatarKey) {
      const source = path.resolve(import.meta.dirname, "../src/assets/images/avatars", DEFAULT_AVATAR);
      defaultFilename ??= await prepareAvatar(source, outputAvatarDir, "default");
      avatarKey = defaultFilename;
    }

    friends.push({ name: String(row.nickname ?? "").trim(), url, avatar: avatarKey });
    report.friends.exported += 1;
  }

  return friends;
}

async function main() {
  const { db: dbPath, out, avatars } = parseCli();
  if (!fs.existsSync(dbPath)) fail(`快照不存在：${dbPath}`);

  const postsDir = path.join(out, "posts");
  const ocDir = path.join(out, "oc");
  assertEmptyDir(out);
  fs.mkdirSync(postsDir, { recursive: true });
  fs.mkdirSync(ocDir, { recursive: true });

  // readOnly：绝不建表、绝不升级旧表结构。
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const integrity = db.prepare("PRAGMA integrity_check").get();
  if (Object.values(integrity)[0] !== "ok") fail(`快照完整性检查未通过：${JSON.stringify(integrity)}`);

  const report = { generatedAt: new Date().toISOString(), source: path.basename(dbPath), urls: [] };

  exportPosts(db, postsDir, report);
  exportOc(db, ocDir, report);

  const friends = await exportFriends(db, avatars, report, out);
  fs.writeFileSync(path.join(out, "friends.json"), `${JSON.stringify(friends, null, 2)}\n`, "utf8");
  db.close();

  fs.writeFileSync(path.join(out, "reconciliation.private.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`已发布文章 ${report.posts.published} 篇（排除草稿 ${report.posts.draftsExcluded} 篇）`);
  console.log(`OC 章节 ${report.oc.count} 节`);
  console.log(`友链 ${report.friends.exported} 条（候选 ${report.friends.candidates} 条）`);
  if (report.friends.rejected.length) console.log(`待人工确认友链 ${report.friends.rejected.length} 条`);
  if (report.friends.missingAvatars.length) console.log(`缺头像 ${report.friends.missingAvatars.length} 条，已回退默认图`);
  if (report.posts.emptyBodies.length) console.log(`正文为空 ${report.posts.emptyBodies.length} 篇，需核对：${report.posts.emptyBodies.join(", ")}`);
  console.log(`私有对账表：${path.join(out, "reconciliation.private.json")}`);
}

await main();
