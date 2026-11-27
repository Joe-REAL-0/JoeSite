# JoeSite 自助友链搭建指南

当前申请入口已在主站实现，复用 GitHub 登录，支持浏览器头像裁切、D1 保存及 Cloudflare 审核邮件。部署方法见 README 的“友链申请”一节。同意、拒绝链接按当前需求留空，后续发布项目尚待搭建。

以下保留为后续独立发布服务与 OpenList/OSS 的方案参考，涉及独立申请页、票据交接和 SMTP 的内容需要按当前实现调整。

**可行。** 主站继续由 `JoeSite-frontend` 用 Astro 在边缘发布静态 HTML；独立的 `JoeSite-friend-links` 服务端仓库部署在能访问 OpenList 的 tailnet 节点。前端现有 Better Auth 负责 GitHub 登录，申请服务通过短时一次性票据验证本站会话，不另建 OAuth 登录。服务端负责裁剪申请、邮件审批、OSS 上传和向前端仓库提交友链 PR。组织名仍待确定；两仓库职责见下一节。

本文是按当前仓库和官方接口编写的搭建方案。申请服务、发布机器人和自动部署需要配置或开发。OpenList 实例版本、挂载路径、OSS 权限、邮件投递和线上分支规则尚待你在部署环境中验证。建议先做第 1 节的一张图往返测试，再接登录和发布。
## 仓库与身份边界

以一个 GitHub Organization 管理两个独立仓库。组织名尚未确定，以下使用 `<ORG>` 占位；`JoeSite-frontend` 是当前仓库名，服务端仓库建议命名为 `JoeSite-friend-links`。改名后把克隆地址和 Cloudflare Workers Builds 的 GitHub 连接一并更新。GitHub 会将旧仓库 URL 重定向，但部署集成、OAuth 应用回调和机器人安装范围仍须检查。

| 仓库 | 负责内容 | 秘密和权限 |
| --- | --- | --- |
| `<ORG>/JoeSite-frontend` | 当前 Astro 页面、Better Auth、D1、友链 `friends.json`、Cloudflare Worker/静态构建与生产部署 | GitHub OAuth App 凭据和 Better Auth secret 留在 Cloudflare Worker secrets；用户与会话留在其 D1。发布 App 对此仓库只需最小化的内容与 PR 权限 |
| `<ORG>/JoeSite-friend-links` | 申请/裁剪表单、待审批数据库、SMTP 通知、管理审批、OpenList/OSS 上传、申请状态机与前端发布身份交接 | 仅服务端保管 SMTP、OpenList 服务账号和发布用 GitHub App 私钥。不得复制 Better Auth secret、D1 凭据或 OAuth 用户令牌 |

当前前端 Worker 中 `src/lib/auth.js` 已用 Better Auth GitHub provider；`src/worker.js` 将 `/api/auth/*` 送入 Better Auth，`src/lib/interactions.js` 也通过 `auth.api.getSession({ headers })` 读取当前 D1 会话。因此不应在申请服务再注册一套独立的 GitHub OAuth 登录：那会产生第二套 OAuth 授权与身份会话，并不能验证用户在本站的 Better Auth 登录状态。

### Better Auth 到申请服务的登录交接

浏览器 Cookie 属于 `furryjoe.site`，不会自动发送到 `apply.furryjoe.site` 或 OpenList 主机；把 D1 暴露给申请服务也扩大了认证数据库的信任边界。建议由前端 Worker 在主站域名下新增一次性交接接口：

1. 前端按钮请求同源 `/api/friend-apply/ticket`。Worker 用现有 Better Auth `getSession` 验证登录，未登录返回 401 并引导用户走既有 GitHub 登录。
2. Worker 为当前 `github.id` 生成不可预测的一次性票据，在前端 D1 写入专用表，记录到期时间（例如 60 秒）和未消费状态。接口以不可缓存的 HTML auto-submit form 把票据用 POST body 送到 `https://apply.furryjoe.site/auth/redeem`；不要放 query string、URL hash、`localStorage`、Referer 或日志。
3. 申请服务接收票据后，用仅服务端持有的随机高熵共享密钥调用前端 Worker `/api/friend-apply/redeem`。Worker 原子消费且只返回签发时写入的 GitHub ID；重复、过期、签名缺失或错误来源都拒绝。交接接口不返回 Better Auth Cookie、OAuth access token 或邮箱。
4. 申请服务用该 ID 建自己的最小会话并呈现表单。审批权限仍由申请服务会话和固定的 `ADMIN_GITHUB_ID` 判断，不能用普通申请票据授权站主操作。

共享密钥分别存作前端 Worker secret 和申请服务 secret；配置独立轮换。前端 D1 迁移只新增交接票据表，不读取或复制 Better Auth 的 user/account/session 表。申请服务的实现、D1 迁移以及前端两个 ticket handler 是两仓库的明确跨仓库接口，先约定请求/响应、票据过期与重放测试再并行开发。

如果申请服务不需要证明“用户已登录 JoeSite”，只需确认 GitHub 身份，才采用独立 OAuth App；那种做法只能证明用户授权了该应用，不能声称复用了 Better Auth 登录态。

## 当前项目的接入点

| 已核对的位置 | 实施时改什么 |
| --- | --- |
| `src/pages/friend_link/index.astro` 在构建时调用 `loadFriends()`，用 `<img src={link.avatar}>` 输出卡片 | 可以直接渲染 HTTPS 头像地址。把申请按钮从 `site.issueUrl` 改成单独的 `site.friendApplyUrl`，例如 `https://apply.furryjoe.site/`。用普通超链接跳转 |
| `src/_data/friends.json` 的公开字段为 `name`、`url`、`avatar` | 保持为已发布友链的唯一数据源。审核状态、登录标识、邮箱留在申请服务 |
| `scripts/content.mjs` 的 `loadFriends()` 会给空头像补 `/images/avatars/default_avatar.png` | 迁移默认图时一起改兜底和 `test/content.test.mjs` 的对应断言。构建校验可限定头像为配置的 HTTPS 图床域名和头像前缀 |
| `astro.config.mjs` 显式复制 8 张头像。`wrangler.jsonc` 将 `./dist` 绑定到 `ASSETS`，`src/worker.js` 只转发静态资源 | 主站无需新增登录、数据库绑定或上传路由。保留 `test/build.test.mjs` 对静态产物的检查 |
| `.github/AGENTS.md` 指定 `dev` 日常开发、`main` 通过 PR 合入。`package.json` 有手动部署命令 | 在生产分支接上自动构建。仅修改 GitHub 文件，现网 HTML 不会自行更新 |

## 1. 打通 OpenList 写入与匿名读图

三个地址各承担一段流量。`http://100.124.134.117:5244` 供 tailnet 内的发布进程上传。`https://cloud.furryjoe.site/` 是当前网盘入口。下文建议新增 `https://img.furryjoe.site` 专门读公开头像，`img` 和 `apply` 均为待配置域名。

1. **准备 OSS。** 建一个只存公开展示素材的私有 Bucket，记录地域和该地域的 HTTPS Endpoint。给 OpenList 单独创建 RAM 身份，授予挂载所需的桶级列举以及 `avatars/` 前缀内的对象读取、写入权限。列举限制到所需前缀；如驱动读取桶信息则按实际请求补权限。不要给主账号密钥、整桶公共写或无关 Bucket 权限。[OSS 地域与 Endpoint](https://help.aliyun.com/zh/oss/user-guide/regions-and-endpoints)
2. **挂载。** 在 OpenList 管理 → 存储 → 添加，选择 **S3** 驱动。填写 Bucket、Region、Endpoint 和专用 AccessKey，使用 OSS 支持的虚拟主机寻址。下面假设挂载点 `/joesite` 对应 Bucket 根，管理员先建好 `avatars/`。创建服务账号，基本路径设为 `/joesite/avatars`，开“创建目录或上传”，关删除、移动、离线下载和管理权限。对这个账号，API 路径 `/abc.webp` 即 OSS 对象 `avatars/abc.webp`。先用服务账号核对这个映射，避免路径重复。[OpenList S3 驱动](https://doc.oplist.org/guide/drivers/s3) · [用户基本路径与权限](https://doc.oplist.org/guide/advanced/user)
3. **配置公网读。** 在阿里云 CDN 添加 `img.furryjoe.site`，源站选上述 OSS Bucket，授权并开启私有 Bucket 回源，配置 DNS CNAME 和 HTTPS 证书。图片路径允许匿名 GET，回源身份只读。按加速地域核对备案要求和流量费用。另一种选择是复用 `https://cloud.furryjoe.site/d/joesite/avatars/<文件名>`，前提是该 OpenList 路径在你的配置中可以长期匿名取图，且不会开放其他目录或公网上传。后者还依赖 OpenList 在线。不要把登录后的下载地址、一次性签名或 tailnet IP 存进 `friends.json`。[阿里云 CDN 私有 OSS 回源](https://help.aliyun.com/zh/cdn/user-guide/grant-alibaba-cloud-cdn-access-permissions-on-private-oss-buckets)
4. **验证一次真实上传。** 在将运行发布任务的 tailnet 主机上执行下例，需要 Bash、curl、jq，以及一张可公开的测试 PNG。用 tailnet ACL 限制该主机到 OpenList 的 TCP 5244，确认容器内也有路由。OpenList 请求只走该私网地址，避免代理转发凭据。示例按 OpenList v4 的同步上传接口编写。按实际版本核对鉴权方式。[登录 API](https://openlistteam.github.io/docs/guide/api/auth.html) · [文件 API](https://openlistteam.github.io/docs/guide/api/fs.html) · [v4.2.6 同步上传处理](https://github.com/OpenListTeam/OpenList/blob/v4.2.6/server/handles/fsup.go)

```bash
# 在私有终端执行，关闭 shell xtrace。login.json 放在仓库外，权限 0600，
# 内容为 {"username":"专用服务账号","password":"该账号密码"}。
set -euo pipefail
ol=http://100.124.134.117:5244
img=https://img.furryjoe.site/avatars
png=static/images/avatars/default_avatar.png  # 或本机测试图的路径
key="probe-$(date +%s).png"
token=$(curl --noproxy '*' -fsS --max-time 15 "$ol/api/auth/login" \
  -H 'Content-Type: application/json' --data-binary @"$HOME/.config/joesite/login.json" |
  jq -er 'select(.code == 200) | .data.token | strings | select(length > 0)')
printf 'Authorization: %s\n' "$token" | curl --noproxy '*' -fsS --max-time 30 \
  -X PUT "$ol/api/fs/put" -H @- -H "File-Path: /$key" \
  -H 'As-Task: false' -H 'Content-Type: image/png' --data-binary @"$png" |
  jq -e '.code == 200'
unset token
out=$(mktemp)
curl -fsSL --max-time 30 "$img/$key" -o "$out"
cmp "$png" "$out"  # 此测试关闭 CDN 图片转码；验证收到的不是登录页
rm -f "$out"
```

在 OSS 控制台确认对象键确实是 `avatars/probe-….png`。再用未接入 tailnet 的手机打开公网 URL，确认 HTTPS、`Content-Type: image/png` 与页面内显示。上传成功时 OpenList 可以只返回成功状态，**最终头像地址由发布进程用已验证的公开前缀和对象键生成**。如果上传成功但匿名读返回 403，检查 CDN 回源授权或 OpenList 下载签名；若返回 HTML，检查是否使用了目录预览地址。此关通过后再迁移数据。

## 2. 部署申请服务并复用 Better Auth 登录

把服务放在独立仓库或独立部署目录。单机可用 Node.js、SQLite、私有暂存目录和一个后台任务进程，服务与任务共用持久卷。用 systemd 或容器启动并自动重启。通过 Cloudflare Tunnel 把新主机名 `apply.furryjoe.site` 映射到同机的 `http://127.0.0.1:8788`（示例监听端口）。Tunnel 仅发布申请服务，OpenList 的写入口留在 tailnet。表单、回调、预览和审批使用同一 HTTPS 源，请对这些路径禁用 CDN 缓存。[Cloudflare Tunnel 设置](https://developers.cloudflare.com/tunnel/setup/)

| 服务端配置示例 | 放置位置与用途 |
| --- | --- |
| `APP_ORIGIN=https://apply.furryjoe.site`、`SESSION_SECRET`、`FRONTEND_TICKET_REDEEM_URL`、`FRONTEND_TICKET_REDEEM_SECRET` | 申请服务。它不持有 GitHub OAuth 凭据；用户由 `JoeSite-frontend` 的 Better Auth 登录后通过一次性 ticket 交接身份 |
| `ADMIN_GITHUB_ID`、`REVIEW_EMAIL`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`MAIL_FROM` | 审批权限用站主固定数字 ID，收件人用站主邮箱。用邮箱服务商要求的 TLS 和应用密码或邮件服务密钥，并验证发件地址 |
| `DB_PATH`、`STAGING_DIR` | 只给服务账号读写的持久路径，如 `/var/lib/joesite-apply/app.db`、`/var/lib/joesite-apply/staging/`，位于 Web 根目录外 |
| `OPENLIST_BASE`、`OPENLIST_USER`、`OPENLIST_PASSWORD`、`AVATAR_PUBLIC_BASE=https://img.furryjoe.site/avatars` | 仅发布进程需要上传凭据。OSS AccessKey 留在 OpenList |
| `GITHUB_APP_ID`、`GITHUB_INSTALLATION_ID`、`GITHUB_PRIVATE_KEY`、`PUBLISH_REPO=<ORG>/JoeSite-frontend`、`PUBLISH_BRANCH=main` | 仅发布进程需要的 GitHub App 身份；App 仅安装到前端仓库，与申请者认证完全分开 |

这些是新服务的配置名。密钥用服务端秘密管理或受限文件注入；Astro 的公开配置只需申请地址和图片地址。

**申请入口的行为**

1. `GET /` 检查本服务的会话。无会话时，页面请求前端 Worker 的 ticket 入口；它验证现有 Better Auth 会话后，将一次性 GitHub 数字 ID 交给申请服务。申请服务不接收 OAuth code/token，不读 GitHub 登录 Cookie。
2. 前端 Worker 的 ticket 接口、D1 一次性票据表和申请服务 redeem endpoint 必须同时部署并端到端测试。每张票据短时有效、只消费一次、只能用于登录交接；它不是审批凭据。
3. 服务端用 ticket 中交接的 GitHub ID 建申请会话，换发会话 ID，Cookie 设 `Secure; HttpOnly; SameSite=Lax`、限申请域名并有过期时间。申请 POST 和审批 POST 均重新校验会话、Origin 和 CSRF token，不能信任表单传来的 GitHub ID。
4. 在 `src/_data/site.json` 加 `friendApplyUrl`，在友链页通过前端按钮先请求主站 ticket，再 POST 跳转到申请服务。到 ticket 与 redeem 两端都验收后再上线该入口。列表仍直接出现在构建后的 HTML 中。

**GitHub 设置。** 创建发布用 GitHub App，仅安装在 `<ORG>/JoeSite-frontend`，授予 Contents、Pull requests 的读写权限，用短期 installation token 操作分支和 PR。服务端仓库不需要该 App。前端仓库启用 *Allow auto-merge*，给 `main` 配置必需的 PR 检查，至少跑 `npm ci`、`npm test`、`npm run build`。给机器人 PR 增加差异检查，仅允许改 `friends.json` 且只增一条合法记录。检查配置放在受保护的前端代码中。机器人对该 PR 启用自动合并，条件已满足时可直接按正常 PR 流程合并。若分支规则要求 GitHub 上的人工 review，邮件批准不能满足该规则，仍需站主在 PR 审核；需要“一次批准全自动”时，可让邮件打开对应审批页面并将最终决定放在 GitHub 的人工 PR review，但这会改变当前先审后上传的时序。要保持本文时序又只点一次，应在可接受的规则下配置该内容发布流程，以实际分支保护结果为准。[GitHub App 安装身份](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-an-installation) · [自动合并条件](https://docs.github.com/en/pull-requests/how-tos/merging-and-closing-pull-requests/automatically-merging-a-pull-request)

**Cloudflare 设置。** 只将 `<ORG>/JoeSite-frontend` 连接到 Workers Builds；服务端仓库由 OpenList 节点上的容器/systemd 流程独立部署，不接入前端 Worker 的 D1/KV。Workers Builds 根目录选前端项目根、生产分支选 `main`，Node 版本满足 `package.json` 的 `>=22.23.4`。使用锁文件安装依赖，构建命令 `npm run build`，部署命令 `npx wrangler deploy`，避免用会再构建一次的 `npm run deploy` 作部署步骤。PR 检查与生产部署分别配置，确认第一次测试合并触发的是正式域名对应的 Worker。后续将 `main` 的内容更新同步回日常 `dev` 分支。[Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) · [生产分支](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
| --- | --- |
| 填展示名、网站 URL，可选本地图片 | 申请网页用文件选择器加 1:1 裁剪框（如 [Cropper.js](https://github.com/fengyuanchen/cropperjs)），预览最终正方形，Canvas 导出 Blob，以 `multipart/form-data` POST `/applications`。未选图时明确展示“使用当前 GitHub 头像” |
| 提交自选图 | 限制体积和解码像素，例如 5 MiB、1600 万像素。服务端用图像库识别并解码 JPEG/PNG/WebP，校正方向、重编码为 256×256 静态 WebP，清除元数据，拒绝 SVG 和不可解码内容。用生成的 ID 命名，只私存验收后的字节 |
| 未选图 | 从已验证 GitHub 资料中的 `avatar_url` 下载一份快照，按同一规则居中裁剪、重编码、暂存。仅允许预期的 GitHub 头像 HTTPS 主机，禁用重定向或逐跳检查，限制超时和下载量。下载失败提示重试或自行上传。用户填的网站只作为链接，不去抓 favicon |
| 收到申请 | 服务端解析并限制 `url` 为含主机且无内嵌凭据的 HTTP(S) 地址；展示名设长度上限，按纯文本输出。按 GitHub ID/IP 限频、规范化 URL 去重。先存图，再同一 SQLite 事务写申请和待发邮件任务，返回申请编号及“待审批” |
| 站主收邮件 | 后台任务经 SMTP 发到固定 `REVIEW_EMAIL`，含申请编号、GitHub 用户、展示名、网址和 `APP_ORIGIN/review/<id>`。发件人固定，用户内容转义。SMTP 失败保留待发任务并退避重试，站主可在受限的待办列表看到申请 |
| 站主点邮件 | `GET /review/<id>` 只显示申请和受保护的头像预览。服务端校验申请会话中的 GitHub ID 匹配 `ADMIN_GITHUB_ID`；该会话来自已消费的一次性登录交接。站主明确提交“通过”或“拒绝”的 POST 才改变状态；邮件客户端预读链接不会批准申请。批准动作绑定这份不可变的名称、网址和图片快照 |

建议私库记录 `id, github_id, name, url, staged_file, sha256, status, reviewed_at, object_key, pr_number, merge_sha, last_error`。后台任务保存 `application_id, type, attempts, next_run_at`，对 `(application_id, type)` 建唯一约束。以 `UPDATE … WHERE status='pending'` 原子认领审批，同一事务创建上传任务。拒绝或过期直接清理暂存图；批准则保留到发布完成再清理。备份 SQLite 和暂存目录，确保重启能继续处理。

## 4. 审批后自动发布到静态主站

| 状态 | 进入条件及下一步 |
| --- | --- |
| `pending` | 仅申请人和站主可查看对应申请。拒绝转 `rejected`，结束 |
| `approved` | 发布进程读已审批的暂存图，校验 SHA-256，按第 1 节写 `/<sha256>.webp`。同一内容重试使用同一键。确认 OpenList 业务码成功且公开 GET 可解码为预期图，再记录 `object_key` 和公开 URL |
| `uploaded` | 用 GitHub App 从 `<ORG>/JoeSite-frontend` 最新 `main` 建 `friend/<申请ID>`，解析 JSON，向前端仓库的 `src/_data/friends.json` 追加一条 `{ "name": "展示名", "url": "https://example.org/", "avatar": "https://img.furryjoe.site/avatars/<sha256>.webp" }`。固定目标文件，用 JSON 序列化写回，只开一个 PR。遇到同 URL、不同资料则交站主确认，不能覆盖已有站点 |
| `pr_open` | 必需检查通过后自动合入，记录合并 SHA。多申请可串行发布；分支落后或冲突则按最新内容重新应用该条并重跑检查。任务重启先查申请分支、PR 和线上记录，避免重复追加 |
| `deploying` → `published` | `main` 更新触发生产构建。核对对应版本部署成功，并从 `https://furryjoe.site/friend_link/` 的 HTML 找到该 URL 和头像，才向站主标为已发布。构建失败保留前一版，按失败阶段重试 |

**GitHub 设置。** 创建发布用 GitHub App，仅安装在 `<ORG>/JoeSite-frontend`，授予 Contents、Pull requests 的读写权限，用短期 installation token 操作分支和 PR。服务端仓库不需要该 App。前端仓库启用 *Allow auto-merge*，给 `main` 配置必需的 PR 检查，至少跑 `npm ci`、`npm test`、`npm run build`。给机器人 PR 增加差异检查，仅允许改 `friends.json` 且只增一条合法记录。检查配置放在受保护的前端代码中。机器人对该 PR 启用自动合并，条件已满足时可直接按正常 PR 流程合并。若分支规则要求 GitHub 上的人工 review，邮件批准不能满足该规则，仍需站主在 PR 审核；需要“一次批准全自动”时，可让邮件打开对应审批页面并将最终决定放在 GitHub 的人工 PR review，但这会改变当前先审后上传的时序。要保持本文时序又只点一次，应在可接受的规则下配置该内容发布流程，以实际分支保护结果为准。[GitHub App 安装身份](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-an-installation) · [自动合并条件](https://docs.github.com/en/pull-requests/how-tos/merging-and-closing-pull-requests/automatically-merging-a-pull-request)

**Cloudflare 设置。** 只将 `<ORG>/JoeSite-frontend` 连接到 Workers Builds；服务端仓库由 OpenList 节点上的容器/systemd 流程独立部署，不接入前端 Worker 的 D1/KV。Workers Builds 根目录选前端项目根、生产分支选 `main`，Node 版本满足 `package.json` 的 `>=22.23.4`。使用锁文件安装依赖，构建命令 `npm run build`，部署命令 `npx wrangler deploy`，避免用会再构建一次的 `npm run deploy` 作部署步骤。PR 检查与生产部署分别配置，确认第一次测试合并触发的是正式域名对应的 Worker。后续将 `main` 的内容更新同步回日常 `dev` 分支。[Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) · [生产分支](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)

## 5. 一次性迁移现有头像

当前 JSON 有 **9 条友链、8 个不同的本地头像路径**。其中 Lie_Kong 与缎金SatinAu 共用 `default_avatar.png`。以当前发布清单为准，避免把未公开的本地文件或旧站快照带进 OSS。下面的只读命令可随最新分支重新盘点。

```bash
jq -r '.[].avatar' src/_data/friends.json | sort | uniq -c
```

1. 保存当前提交号、`friends.json` 和可用的上一版 `dist/`。在 `dev` 的迁移分支上，对每个唯一引用定位 `static` 加该路径的文件，按实际字节识别类型（其中一张名为 `38c78095_01.png.jpg`），核对齐全再上传。
2. 复用相同的 OpenList 专用账号和公开读前缀。保留原图外观，可直接上传经校验的 PNG/JPEG，按实际字节哈希和真实格式生成对象名。留一份私有映射 `旧路径 → SHA-256 → OSS key → 公网 URL`。两条默认头像引用使用同一 URL。逐一匿名 GET 校验类型和内容，任一失败先保留旧引用。
3. 在同一个迁移 PR 替换 9 条记录的 `avatar`，保留名字、网址和排列顺序。将 `loadFriends()` 的空头像兜底指向迁移后的默认图，并更新相应测试。`scripts/import-content.mjs` 会重新生成本地路径；今后再做旧站导入时，只在临时目录导出，按映射合并，保留站主已指定的头像。
4. `npm ci && npm test && npm run build`，预览 `dist/friend_link/index.html`，核对 9 张卡片均已从图床取图、禁用 JS 仍能展示。上线观察后，从 `astro.config.mjs` 移除已替换的 8 条头像复制项。若旧的 `/images/avatars/…` 仍有外部引用，保留这些文件或先配置逐个重定向。
5. 回滚迁移时还原该 PR 并重建，紧急情况下恢复上一版静态部署。保留旧图及 OSS 对象直到回滚窗口结束。撤下一条新友链也通过 PR 移除记录和重建，最后再检查对象是否被其他友链共用。

## 上线验收

| 操作 | 通过标准 |
| --- | --- |
| 未登录点申请、已登录点申请、重放或过期 ticket | 未登录时按前端现有流程完成 Better Auth GitHub 登录；已登录只能消费一次有效 ticket 并进入申请表单；过期、重复消费、错误共享密钥均拒绝。审批身份必须仍由独立管理会话核验 |
| 一次上传并裁剪，一次不传图 | 两张审批预览分别与裁剪图和 GitHub 快照相符。提交后主站、公开 Git 和 OSS 均未出现待审资料 |
| 邮件预读、普通账号打开审批链接、站主拒绝、对同一申请重复点通过 | 预读不改变状态，普通账号无法审批；拒绝无上传；通过只建一个发布任务 |
| 模拟 SMTP 中断、OpenList 不通、GitHub PR 冲突或生产构建失败 | 已发布页面可浏览；申请停在对应阶段，有失败原因，恢复后无需重新申请或重复发友链 |
| 站主批准有效申请，用移动网络打开正式站 | 先有匿名可读头像，再合 PR、触发部署，正式 HTML 出现且只出现一条该友链。头像请求命中 HTTPS 图床，无需网盘 Cookie |
| 迁移后核对旧友链并测试回滚 | 9 条名字和网址未变；8 个不同头像键均可读；前一版部署仍能正确显示头像 |
