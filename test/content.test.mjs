import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import {
  buildPages,
  sortPosts,
  pageUrl,
  pageOutputPath,
  postUrl,
  loadFriends,
  POSTS_PER_PAGE,
} from "../scripts/content.mjs";
import { parseChinaTime, formatChinaTime, formatChinaDate, formatRfc822 } from "../scripts/time.mjs";

const makePost = (id, createdTime) => ({
  id,
  createdAt: parseChinaTime(createdTime),
});

test("分页：0 篇仍产出第 1 页，供 /blog/ 使用", () => {
  const pages = buildPages([]);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].number, 1);
  assert.equal(pages[0].posts.length, 0);
  assert.equal(pages[0].totalPages, 0);
  assert.equal(pages[0].url, "/blog/");
  assert.equal(pages[0].outputPath, "blog/index.html");
  assert.equal(pages[0].prevUrl, "");
  assert.equal(pages[0].nextUrl, "");
});

test("分页：1 篇只有一页，没有翻页地址", () => {
  const pages = buildPages([1].map((id) => ({ id })));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].totalPages, 1);
  assert.equal(pages[0].posts.length, 1);
  assert.equal(pages[0].nextUrl, "");
});

test("分页：恰好 10 篇只有一页", () => {
  const pages = buildPages(Array.from({ length: 10 }, (_, index) => ({ id: index + 1 })));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].posts.length, 10);
  assert.equal(pages[0].totalPages, 1);
});

test("分页：11 篇分成 10 + 1，第二页有独立路径", () => {
  const pages = buildPages(Array.from({ length: 11 }, (_, index) => ({ id: index + 1 })));
  assert.equal(pages.length, 2);
  assert.equal(pages[0].posts.length, 10);
  assert.equal(pages[1].posts.length, 1);
  assert.equal(pages[0].nextUrl, "/blog/page/2/");
  assert.equal(pages[1].prevUrl, "/blog/");
  assert.equal(pages[1].nextUrl, "");
  assert.equal(pages[1].outputPath, "blog/page/2/index.html");
});

test("分页：合并各页与原文顺序一致，不重不漏", () => {
  const posts = Array.from({ length: 23 }, (_, index) => ({ id: index + 1 }));
  const merged = buildPages(posts).flatMap((page) => page.posts.map((post) => post.id));
  assert.deepEqual(merged, posts.map((post) => post.id));
});

test("分页：每页条数必须是正整数", () => {
  assert.throws(() => buildPages([], 0), /正整数/);
  assert.throws(() => buildPages([], -1), /正整数/);
  assert.throws(() => buildPages([], 2.5), /正整数/);
  assert.equal(POSTS_PER_PAGE, 10);
});

test("地址：第 1 页在 /blog/，详情沿用数字 ID", () => {
  assert.equal(pageUrl(1), "/blog/");
  assert.equal(pageUrl(2), "/blog/page/2/");
  assert.equal(pageOutputPath(1), "blog/index.html");
  assert.equal(postUrl(42), "/blog/42/");
});

test("排序：创建时间倒序，同一时间按 ID 倒序", () => {
  const posts = [
    makePost(3, "2024-01-02 10:00:00"),
    makePost(9, "2024-01-01 10:00:00"),
    makePost(5, "2024-01-02 10:00:00"),
    makePost(1, "2023-12-31 23:59:59"),
  ];
  assert.deepEqual(sortPosts(posts).map((post) => post.id), [5, 3, 9, 1]);
});

test("时间：按东八区解释并还原，不受构建机器时区影响", () => {
  assert.equal(formatChinaTime("2024-05-06 00:30:00"), "2024-05-06 00:30:00");
  assert.equal(formatChinaDate("2024-05-06 00:30:00"), "2024-05-06");
  assert.equal(formatRfc822("2024-05-06 00:30:00"), "Mon, 06 May 2024 00:30:00 +0800");
  // 同一时刻用带时区的 ISO 串表达，必须落到同一天
  assert.equal(formatChinaDate("2024-05-05T16:30:00Z"), "2024-05-06");
  assert.equal(formatChinaTime("不是时间"), "");
  assert.equal(formatRfc822("不是时间"), "");
  assert.equal(parseChinaTime(undefined), null);
});

test("友链：只接受展示名与 http(s) 网址，缺头像回退默认图", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "friends-"));
  const file = path.join(dir, "friends.json");

  fs.writeFileSync(file, JSON.stringify([
    { name: "Shadow", url: "https://www.shadow.top" },
    { name: "某友", url: "http://example.com", avatar: "/images/avatars/x.png" },
  ]));
  const friends = loadFriends(file);
  assert.equal(friends.length, 2);
  assert.equal(friends[0].avatar, "/images/avatars/default_avatar.png");
  assert.equal(friends[1].avatar, "/images/avatars/x.png");

  fs.writeFileSync(file, JSON.stringify([{ name: "坏网址", url: "example.com" }]));
  assert.throws(() => loadFriends(file), /http\(s\)/);

  fs.writeFileSync(file, JSON.stringify([{ url: "https://example.com" }]));
  assert.throws(() => loadFriends(file), /缺少 name/);

  fs.writeFileSync(file, JSON.stringify({ not: "array" }));
  assert.throws(() => loadFriends(file), /必须是数组/);
});
