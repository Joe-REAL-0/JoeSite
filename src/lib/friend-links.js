import { Buffer } from "node:buffer";
import { createAuth } from "./auth.js";

const MAX_BODY_BYTES = 768 * 1024;
const MAX_AVATAR_BYTES = 512 * 1024;
const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("申请内容过大，请重新裁切头像");
    }
    chunks.push(value);
  }
  return JSON.parse(await new Blob(chunks).text());
}

function validateAvatar(value) {
  if (typeof value !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const encoded = value.slice("data:image/png;base64,".length);
  if (encoded.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4) return false;
  let bytes;
  try {
    bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    return false;
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || bytes.length > MAX_AVATAR_BYTES || !signature.every((byte, index) => bytes[index] === byte)) return false;
  const view = new DataView(bytes.buffer);
  return view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452
    && view.getUint32(16) === 256 && view.getUint32(20) === 256;
}

function reviewEmail(application, env) {
  const { id, name, url, avatar, githubId, githubName, createdAt } = application;
  const uploaded = avatar.startsWith("data:image/png;base64,");
  const profileUrl = `https://github.com/intent/user?user_id=${githubId}`;
  const record = { id, name, url, avatar, githubId, githubName, createdAt };
  const attachments = [{
    filename: `friend-link-${id}.json`,
    type: "application/json",
    disposition: "attachment",
    content: Buffer.from(JSON.stringify(record, null, 2)).toString("base64"),
  }];
  if (uploaded) attachments.push({
    filename: "avatar.png",
    type: "image/png",
    disposition: "inline",
    contentId: "friend-link-avatar",
    content: avatar.slice("data:image/png;base64,".length),
  });
  return {
    from: env.FRIEND_LINK_MAIL_FROM,
    to: env.FRIEND_LINK_REVIEW_EMAIL,
    subject: `友链申请 · ${name}`,
    text: `收到新的友情链接申请\n申请编号 ${id}\n名称 ${name}\n网址 ${url}\nGitHub ${profileUrl}\nGitHub ID ${githubId}\n头像 ${uploaded ? "见内嵌头像和 JSON 附件" : avatar}\n提交时间 ${new Date(createdAt).toISOString()}\n\n同意\n拒绝\n审核按钮链接暂留空，等待后续发布项目接入。`,
    html: `<html lang="zh-CN"><body>
      <h1>友情链接申请</h1>
      <img src="${uploaded ? "cid:friend-link-avatar" : escapeHtml(avatar)}" width="96" height="96" alt="申请头像">
      <dl>
        <dt>名称</dt><dd>${escapeHtml(name)}</dd>
        <dt>网址</dt><dd><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></dd>
        <dt>GitHub</dt><dd><a href="${escapeHtml(profileUrl)}">${escapeHtml(githubName)}</a>（${escapeHtml(githubId)}）</dd>
        <dt>申请编号</dt><dd>${escapeHtml(id)}</dd>
        <dt>提交时间</dt><dd>${new Date(createdAt).toISOString()}</dd>
      </dl>
      <table role="presentation" cellpadding="12"><tr>
        <td bgcolor="#156643"><a href="" style="color:#ffffff;text-decoration:none">同意</a></td>
        <td bgcolor="#a52646"><a href="" style="color:#ffffff;text-decoration:none">拒绝</a></td>
      </tr></table>
      <p>审核按钮链接暂留空，等待后续发布项目接入。</p>
      <p>完整申请资料和头像保存在 JSON 附件中。</p>
    </body></html>`,
    attachments,
  };
}

export async function handleFriendLinkRequest(request, env) {
  const path = new URL(request.url).pathname;
  const sessionRequest = path === "/api/friend-links/session" && request.method === "GET";
  const submitRequest = path === "/api/friend-links/applications" && request.method === "POST";
  if (!sessionRequest && !submitRequest) return json({ error: "未找到接口" }, 404);
  if (submitRequest && request.headers.get("Origin") !== new URL(request.url).origin) {
    return json({ error: "请从本站提交申请" }, 403);
  }
  if (!env.DB) return json({ error: "登录服务尚未配置" }, 503);

  try {
    const session = await createAuth(env, request.url).api.getSession({ headers: request.headers });
    if (!session?.user) return json({ error: "请先使用 GitHub 登录" }, 401);
    const account = await env.DB.prepare('SELECT "accountId" FROM "account" WHERE "userId" = ? AND "providerId" = ?')
      .bind(session.user.id, "github").first();
    if (!account || !/^\d+$/.test(account.accountId)) return json({ error: "请先使用 GitHub 登录" }, 401);
    const githubId = account.accountId;
    const githubAvatar = `https://avatars.githubusercontent.com/u/${githubId}?s=256`;
    if (sessionRequest) return json({ user: { name: session.user.name, image: githubAvatar }, githubId });
    if (!env.FRIEND_LINK_EMAIL || !env.FRIEND_LINK_MAIL_FROM || !env.FRIEND_LINK_REVIEW_EMAIL) {
      return json({ error: "审核邮件服务尚未配置，请稍后再试" }, 503);
    }
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return json({ error: "请提交 JSON 申请" }, 415);

    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      return json({ error: error instanceof RangeError ? error.message : "申请内容无法解析" }, error instanceof RangeError ? 413 : 400);
    }
    const id = body?.id;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json({ error: "申请编号无效，请刷新页面" }, 400);
    }
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return json({ error: "名称需为 1 到 80 个字符，且不能包含控制字符" }, 400);
    let website;
    try {
      if (typeof body.url !== "string" || body.url.length > 2048) throw new Error();
      website = new URL(body.url);
      if (!["http:", "https:"].includes(website.protocol) || !website.hostname || website.username || website.password) throw new Error();
    } catch {
      return json({ error: "请填写有效的 HTTP(S) 网站地址，且不能包含账号密码" }, 400);
    }
    if (body.avatar != null && !validateAvatar(body.avatar)) return json({ error: "头像需为不超过 512 KiB 的 256×256 PNG 图片" }, 400);
    const avatar = body.avatar ?? githubAvatar;
    const createdAt = Date.now();
    await env.DB.prepare(`INSERT INTO friend_link_applications
      (id, user_id, github_id, github_name, name, url, avatar, created_at, mail_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending') ON CONFLICT(id) DO NOTHING`)
      .bind(id, session.user.id, githubId, session.user.name, name, website.href, avatar, createdAt).run();
    const saved = await env.DB.prepare("SELECT * FROM friend_link_applications WHERE id = ?").bind(id).first();
    if (saved.user_id !== session.user.id || saved.name !== name || saved.url !== website.href || saved.avatar !== avatar) {
      return json({ error: "申请内容已变更，请刷新页面后重新提交" }, 409);
    }
    if (saved.mail_status === "sent") return json({ id, status: "pending_review" });
    const claimed = await env.DB.prepare(`UPDATE friend_link_applications SET mail_status = 'sending', mail_attempt_at = ?
      WHERE id = ? AND (mail_status IN ('pending', 'failed') OR (mail_status = 'sending' AND mail_attempt_at < ?)) RETURNING id`)
      .bind(createdAt, id, createdAt - 120000).first();
    if (!claimed) return json({ error: "这份申请正在发送审核邮件，请稍后重试" }, 409);
    try {
      await env.FRIEND_LINK_EMAIL.send(reviewEmail({
        id, name, url: website.href, avatar, githubId,
        githubName: saved.github_name, createdAt: saved.created_at,
      }, env));
    } catch (error) {
      console.error("Friend link review email failed", id, error.code || error.name);
      await env.DB.prepare("UPDATE friend_link_applications SET mail_status = 'failed' WHERE id = ? AND mail_attempt_at = ?")
        .bind(id, createdAt).run();
      return json({ error: "审核邮件发送失败，申请已保存，请重试提交" }, 502);
    }
    await env.DB.prepare("UPDATE friend_link_applications SET mail_status = 'sent' WHERE id = ? AND mail_attempt_at = ?")
      .bind(id, createdAt).run();
    return json({ id, status: "pending_review" }, 201);
  } catch (error) {
    console.error("Friend link request failed", error.code || error.name);
    return json({ error: "申请服务暂时不可用，请稍后重试" }, 503);
  }
}
