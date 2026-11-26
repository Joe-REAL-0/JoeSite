# Joe_Site

Joe 的个人小站。Astro 在发布时把页面生成到 `dist/`，访客可以直接通过静态服务器访问。

- Astro 负责页面、分页和订阅文件，Svelte 负责主题切换等浏览器交互。Markdown 在构建时渲染。
- 部署目录：`dist/`（HTML、CSS、JS、字体、图片、XML、TXT），可直接放到任意静态服务器。
- 内容源：`src/posts/<原数字ID>.md`、`src/oc/<id>.md`、`src/_data/friends.json`。

## 目录结构

```
.
├── astro.config.mjs       # Astro、Svelte 与公开资源清单
├── src/
│   ├── layouts/           # 共用页面布局
│   ├── components/        # Astro 与 Svelte 组件
│   ├── _data/             # 站点与友链配置
│   ├── posts/             # 已发布文章，一篇文章一个文件
│   ├── oc/                # 档案馆章节，一节一个文件
│   ├── pages/             # 页面路由、博客分页与详情、RSS、站点地图和 robots.txt
│   └── lib/               # 博客数据与订阅生成
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

档案馆默认显示第一节，点击目录可切换正文。章节链接（如 `/oc_introduce/#oc-2`）可直接分享。

友链在 `src/_data/friends.json` 维护，每条包含展示名、`http(s)` 网址和头像路径。本地头像放在 `static/images/avatars/`，并将对应文件加入 `astro.config.mjs` 的公开资源清单。

```json
[{ "name": "悦悦", "url": "https://furryhk.cn/", "avatar": "/images/avatars/github_107252731.jpg" }]
```

## 本地预览

需要 Node.js 22.23.4 或更高版本。

```bash
npm ci
npm run dev       # 启动本地开发服务器（也可用 npm run serve）
npm run build     # 生成 dist/
npm run preview   # 本地预览最近一次构建
npm test          # 构建、渲染与导出的自动化检查
```

只用 `dist/` 起一个普通静态服务器也能验证（不启动任何应用进程）：

```bash
npx serve dist        # 或 python -m http.server -d dist
```

## 发布

### Cloudflare Workers

首次部署前创建 Workers 项目、D1 数据库与 KV namespace，并把返回的资源 ID 填入 `wrangler.jsonc`（`joesite-auth` / `DB`、`INTERACTIONS`）。Worker 对 `/api/*` 先执行，其他路径仍由 Static Assets 返回。
执行迁移并配置 GitHub OAuth App（回调地址必须是 `https://<站点域名>/api/auth/callback/github`，同时授权 `user:email`）：

首次为本地 D1 创建迁移表：

```bash
npx wrangler d1 migrations apply DB --local
```

配置 GitHub OAuth App（回调地址必须是 `https://<站点域名>/api/auth/callback/github`，并授权 `user:email`），并设置 secrets：

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_URL
```

`BETTER_AUTH_URL` 设置为正式站点 origin；本地使用 `wrangler dev` 时，在 `.dev.vars` 配置同名变量。部署前执行 `npx wrangler d1 migrations apply DB --remote`。`BETTER_AUTH_SECRET` 使用至少 32 字符的高熵随机值。

```bash
npm ci
npx wrangler login       # 首次登录；也可使用已配置的 API Token
npm run deploy           # 构建并部署
npm run cf:dev           # 本地启动 Workers 预览
```

部署成功后，Wrangler 会输出 `*.workers.dev` 地址。自定义域名在 Cloudflare 控制台的该 Worker 的 Settings > Domains & Routes 中绑定；域名 DNS 必须由 Cloudflare 管理。`wrangler.jsonc` 中的 Worker 名称是 `joesite`，首次部署会创建此 Worker。

### 其他静态服务器

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

- 档案馆 7 节：与旧站 SQLite 快照一致，保留原 ID、顺序和正文。
- 友链 9 条：链接来自旧站快照；城城、纳纳、炎天、Shadow 和 kzmillion 的头像由站主指定。再次导入时保留这些头像路径。
- 博客 3 篇：从旧站快照导入已发布文章，保留原 ID、正文、时间和标签。
- 日记 `/self_diary`：旧站模板历史上始终是空文件，确认无公开内容，退役为 404，导航、订阅与站点地图都不再引用。

## 互动功能

GitHub OAuth 由 Better Auth 处理，用户、账号和会话保存在 D1；评论与每用户点赞状态保存在 Cloudflare KV。评论公开展示，提交和点赞需先登录。KV 最终一致，点赞总数按用户状态读取。当前仅支持 Cloudflare Workers 部署，普通静态服务器不提供认证及互动 API。

## 友链申请

点击友链页的“申请友情链接”会检查本站 GitHub 会话。登录成功后进入 `/friend_link/apply/`，填写网站名称与 HTTP(S) 地址。可上传不超过 5 MiB、1600 万像素的 PNG、JPEG、WebP，拖动或用方向键调整位置，缩放后输出 256×256 PNG。未上传时使用已登录 GitHub 账号的头像。

主站 Worker 通过 Cloudflare Email Service 的 `EMAIL` 绑定，从 `friend-links@noreply.furryjoe.site` 向 `joe_real@qq.com` 发送审核通知。申请页先尝试专用申请接口；若接口返回 404，则改走同 Worker 的邮件通知接口，直接将申请内容送到审核邮箱，不依赖尚未搭建的自动发布后端。登录检查遇到专用接口 404 时，回退到 Better Auth 的 `/api/auth/get-session`。其他接口错误不会被当作 404 忽略。

部署时需要完成以下配置。

1. 填写 `wrangler.jsonc` 中已有的真实 D1、KV ID，并执行 `npx wrangler d1 migrations apply DB --remote`，应用 `0002_friend_links.sql`。
2. 确认 Cloudflare Email Service 已授权上述发件地址，并按账户套餐要求验证收件地址。
3. 配好前文的 GitHub OAuth 和 Better Auth secrets，再执行 `npm run deploy`。

本地执行 `npx wrangler d1 migrations apply DB --local`、`npm run build` 和 `npm run cf:dev`。`EMAIL` 已配置 `remote: true`，在 `wrangler dev` 中提交申请也会触发真实投递。

邮件发送失败会保留申请并允许以相同申请编号重试。重复提交已发送的编号直接返回成功，同时提交相同编号只由一个请求发送邮件。发送进程中断后，原申请可在两分钟后重新提交。邮件投递与 D1 写入跨服务，极端中断可能产生重复邮件，可用申请编号识别。

后续发布项目可使用 D1 记录或审核邮件 JSON 附件中的 `id`、`name`、`url`、`avatar` 和 GitHub ID。自定义头像在申请记录和附件中保存为 PNG data URL，默认头像保存为 GitHub HTTPS 地址。审核链接和自动发布将在后续项目接入。Cloudflare 接口配置见 [Email Sending Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)。
