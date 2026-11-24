# Joe_Site

Joe 的个人小站。**访客打开任何一个公开页面，静态服务器只需要返回文件**：站点由 Eleventy 在发布时构建成 `dist/`，没有任何应用进程、数据库或站内写接口。

- 技术栈：Eleventy（11ty）+ Nunjucks + 原生 CSS/JavaScript，构建期渲染 Markdown。
- 部署目录：`dist/`（HTML、CSS、JS、字体、图片、XML、TXT），可直接放到任意静态服务器。
- 内容源：`src/posts/<原数字ID>.md`、`src/oc/<id>.md`、`src/_data/friends.json`。

## 目录结构

```
.
├── eleventy.config.js     # 构建配置：输入 src/，输出 dist/，按清单复制资源
├── src/
│   ├── _includes/         # 公共布局与导航片段
│   ├── _data/             # 站点配置、友链、文章与档案装载器
│   ├── posts/             # 已发布文章，一篇文章一个文件
│   ├── oc/                # 档案馆章节，一节一个文件
│   ├── blog/              # 博客列表与详情模板
│   ├── index.njk          # 首页
│   ├── oc_introduce.njk   # 档案馆
│   ├── friend_link.njk    # 友情链接
│   ├── cloud.njk          # 网盘入口
│   ├── sitemap.njk / robots.njk / rss.njk / feed.njk / 404.njk
├── static/                # 样式、脚本、字体、图片（仅清单内的文件会进入 dist）
├── scripts/               # 内容装载、Markdown 渲染、旧站快照导出
├── test/                  # 构建与导出的自动化检查
└── dist/                  # 构建产物，唯一部署目录（不入库）
```

## 日常写作

文章就是一个 Markdown 文件，文件名用旧站的原数字 ID，地址因此永远不变。

```markdown
---
id: 42
title: "标题"
summary: "列表页摘要，可留空自动截取正文"
created_time: "2024-05-06 08:00:00"
updated_time: "2024-05-07 09:30:00"   # 可选
tags: ["随笔", "技术"]
---

正文……
```

规则：

- 时间按**东八区**解释，字符串里不写时区；构建机器的时区不会让日期换日。
- 列表按创建时间倒序、同一时间按 ID 倒序，每页 10 篇；第 2 页起是 `/blog/page/2/` 这样的独立路径。
- 详情地址是 `/blog/<id>/`，改标题不动地址。
- `id` 重复、缺 `title`、时间无法解析都会让构建直接失败，不会静默漏文。

档案馆章节用 `src/oc/<id>.md`：

```markdown
---
id: 1
title: "Joe 角色介绍"
order: 1
---

正文段落之间空一行；段内换行会保留。
```

友链只改 `src/_data/friends.json`，每条只需展示名、`http(s)` 网址和头像路径：

```json
[{ "name": "Shadow", "url": "https://www.shadow.top", "avatar": "/images/avatars/shadow.jpg" }]
```

## 本地预览

```bash
npm ci
npm run build     # 生成 dist/
npm run serve     # 本地预览，改内容自动重建
npm test          # 构建、渲染与导出的自动化检查
```

只用 `dist/` 起一个普通静态服务器也能验证（不启动任何应用进程）：

```bash
npx serve dist        # 或 python -m http.server -d dist
```

## 发布

1. 在分支上改内容，跑 `npm ci && npm run build && npm test`。
2. 把 `dist/` 整目录替换到静态源站（**完整替换**，不要增量覆盖，否则撤下的文章会残留）。
3. 静态服务器需要两条最小配置：
   - 目录索引：`index.html`；
   - 404 页面：`/404.html`（未命中的地址必须真的返回 404，不要回落到首页）。

Nginx 示例：

```nginx
location / {
    try_files $uri $uri/ =404;
    index index.html;
}
error_page 404 /404.html;
```

## 回退

产物是纯文件：保留上一份已验收的 `dist/`，出问题时整目录换回即可，文章、列表和两个订阅地址一起回滚，不涉及数据库。

## 从旧站导入内容

`scripts/import-content.mjs` 只读地读旧站 SQLite 快照，导出公开内容到空目录：

```bash
node scripts/import-content.mjs --db <快照.db> --out <导出目录> --avatars <头像目录>
```

- 只导出 `is_published = 1` 的文章，保留原 ID、正文与时间；草稿、作者邮箱、账号、OAuth、评论与点赞者都不出库。
- 友链只取昵称、网址、头像；网址不是 `http(s)` 的条目写进对账表等待人工确认，不自动猜测。
- 目标目录必须为空，保证可重复导出；每次生成 `reconciliation.private.json`（记录数量、排除项、逐篇正文 SHA-256 与新旧地址对照），**该文件属于私有证据，不入库**。
- 导出结果按 `src/posts/`、`src/oc/`、`src/_data/friends.json` 的形状产出，复制进仓库后即可构建。

## 当前内容状态

- 档案馆 7 节：来自仓库历史提交 `32c8e3f` 的 `static/text/oc_introduce/*.txt`，正文逐字保留。
- 友链 1 条：来自仓库历史快照的 `users` 表。
- 博客：**尚未导入**。仓库内没有 `blogs` 数据，旧站域名也无法从构建环境访问；需要站主提供只读快照后运行上面的导入脚本。在此之前 `/blog/` 生成空列表页（不是 404），不显示任何假计数或占位文章。
- 日记 `/self_diary`：旧站模板历史上始终是空文件，确认无公开内容，退役为 404，导航、订阅与站点地图都不再引用。

## 已下线的内容

登录、注册、找回密码、OAuth、邮箱绑定、个人资料与头像上传、留言、评论、点赞、阅读计数、后台管理与编辑页面、`/api/*`、`/find_text`、`/get_resources` 全部移除。站内没有写请求，页面不依赖会话，本地存储只记住主题偏好。
