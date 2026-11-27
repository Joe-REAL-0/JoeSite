import { createAuth } from "./auth.js";

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

const siteOwnerGitHubId = "137998943"; // Joe-REAL-0

async function getSiteOwnerUserIds(db) {
  const { results } = await db.prepare('SELECT userId FROM account WHERE providerId = ? AND accountId = ?')
    .bind("github", siteOwnerGitHubId).all();
  return new Set(results.map(({ userId }) => userId));
}

const commentKey = (postId, timestamp, id) => `comments:${postId}:${timestamp}:${id}`;
const likeKey = (postId, userId) => `likes:${postId}:${userId}`;

function validPostId(value) {
  return typeof value === "string" && /^\d{1,12}$/.test(value);
}

async function findComment(kv, postId, target) {
  if (typeof target?.id !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(target.id) ||
      !Number.isSafeInteger(target.createdAt) || target.createdAt <= 0) return null;
  const comment = await kv.get(commentKey(postId, target.createdAt, target.id), "json");
  return comment?.id === target.id ? comment : null;
}

async function getCommentLikes(db, postId, ids, userId) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await db.prepare(`SELECT comment_id, COUNT(*) AS likes,
    MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked
    FROM comment_likes WHERE post_id = ? AND comment_id IN (${placeholders}) GROUP BY comment_id`)
    .bind(userId ?? null, postId, ...ids).all();
  return new Map(results.map((row) => [row.comment_id, { likes: row.likes, liked: Boolean(row.liked) }]));
}

const noCommentLikes = { likes: 0, liked: false };

async function getUser(request, env) {
  const auth = createAuth(env, request.url);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

async function getLikeCount(kv, postId) {
  let cursor;
  let count = 0;
  do {
    const page = await kv.list({ prefix: `likes:${postId}:`, limit: 1000, cursor });
    for (let offset = 0; offset < page.keys.length; offset += 100) {
      const keys = page.keys.slice(offset, offset + 100).map(({ name }) => name);
      const values = await kv.get(keys);
      for (const value of values.values()) if (value === "1") count += 1;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return count;
}

async function getCommentCount(kv, prefix, page) {
  let count = 0;
  let current = page ?? await kv.list({ prefix, limit: 1000 });
  for (;;) {
    count += current.keys.length;
    if (current.list_complete) return count;
    current = await kv.list({ prefix, limit: 1000, cursor: current.cursor });
  }
}

export async function handleInteractionRequest(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const isStats = parts.length === 3 && parts[2] === "stats" && request.method === "GET";
  if (parts[0] !== "api" || parts[1] !== "posts" || (!isStats && !validPostId(parts[2]))) {
    return json({ error: "Not found" }, 404);
  }
  const postId = parts[2];

  if (parts.length === 4 && parts[3] === "view" && request.method === "POST") {
    if (request.headers.get("Origin") !== url.origin) return json({ error: "请求来源无效" }, 403);
    if (!env.DB) return json({ error: "View storage unavailable" }, 503);

    const article = await env.ASSETS.fetch(new Request(new URL(`/blog/${postId}/`, url), { method: "HEAD" }));
    if (!article.ok) return json({ error: "文章不存在" }, 404);

    await env.DB.prepare(`INSERT INTO post_views (post_id, views) VALUES (?, 1)
      ON CONFLICT (post_id) DO UPDATE SET views = views + 1`).bind(postId).run();
    return new Response(null, { status: 204 });
  }
  if (!env.INTERACTIONS) return json({ error: "Interactions storage unavailable" }, 503);

  if (isStats) {
    const ids = [...new Set(url.searchParams.get("ids")?.split(","))];
    if (!ids.length || ids.length > 10 || !ids.every(validPostId)) {
      return json({ error: "文章 ID 无效" }, 400);
    }
    if (!env.DB) return json({ error: "View storage unavailable" }, 503);
    const placeholders = ids.map(() => "?").join(", ");
    const [likes, { results }] = await Promise.all([
      Promise.all(ids.map(async (id) => [id, await getLikeCount(env.INTERACTIONS, id)])),
      env.DB.prepare(`SELECT post_id, views FROM post_views WHERE post_id IN (${placeholders})`).bind(...ids).all(),
    ]);
    const views = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const row of results) views[row.post_id] = row.views;
    return json({ likes: Object.fromEntries(likes), views });
  }

  if (parts.length === 3 && request.method === "GET") {
    const prefix = `comments:${postId}:`;
    const cursor = url.searchParams.get("cursor") || undefined;
    const kv = env.INTERACTIONS;
    const listed = await kv.list({ prefix, limit: 50, cursor });
    const [comments, commentCount, likes] = await Promise.all([
      listed.keys.length ? kv.get(listed.keys.map(({ name }) => name), "json") : new Map(),
      getCommentCount(kv, prefix, cursor ? undefined : listed),
      getLikeCount(kv, postId),
    ]);
    const user = await getUser(request, env);
    const liked = user ? await env.INTERACTIONS.get(likeKey(postId, user.id)) === "1" : false;
    const ordered = [...comments.values()].filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
    const [reactions, ownerUserIds] = await Promise.all([
      getCommentLikes(env.DB, postId, ordered.map(({ id }) => id), user?.id),
      ordered.length ? getSiteOwnerUserIds(env.DB) : new Set(),
    ]);
    return json({
      likes,
      commentCount,
      liked,
      comments: ordered.map((comment) => ({
        ...comment,
        ...(reactions.get(comment.id) ?? noCommentLikes),
        isSiteOwner: ownerUserIds.has(comment.userId),
      })),
      cursor: listed.list_complete ? null : listed.cursor,
    });
  }

  if (parts[3] === "like" && request.method === "POST") {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const key = likeKey(postId, user.id);
    const liked = await env.INTERACTIONS.get(key) !== "1";
    await env.INTERACTIONS.put(key, liked ? "1" : "0");
    return json({ liked, likes: await getLikeCount(env.INTERACTIONS, postId) });
  }

  if (parts[3] === "comments" && (request.method === "POST" || request.method === "PUT")) {
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) return json({ error: "请求来源无效" }, 403);
  }

  if (parts.length === 6 && parts[3] === "comments" && parts[5] === "like" && request.method === "PUT") {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => null);
    if (typeof body?.liked !== "boolean") return json({ error: "点赞状态无效" }, 400);
    const id = parts[4];
    if (!await findComment(env.INTERACTIONS, postId, { id, createdAt: body.createdAt })) {
      return json({ error: "评论不存在" }, 404);
    }
    const sql = body.liked
      ? "INSERT INTO comment_likes (post_id, comment_id, user_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING"
      : "DELETE FROM comment_likes WHERE post_id = ? AND comment_id = ? AND user_id = ?";
    await env.DB.prepare(sql).bind(postId, id, user.id).run();
    const reactions = await getCommentLikes(env.DB, postId, [id], user.id);
    return json(reactions.get(id) ?? noCommentLikes);
  }

  if (parts.length === 4 && parts[3] === "comments" && request.method === "POST") {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 2000) return json({ error: "评论需为 1 到 2000 个字符" }, 400);
    let replyTo;
    if (body.replyTo != null) {
      const parent = await findComment(env.INTERACTIONS, postId, body.replyTo);
      if (!parent) return json({ error: "被回复的评论不存在" }, 404);
      replyTo = { id: parent.id, name: parent.name };
    }
    const id = crypto.randomUUID();
    const comment = {
      id,
      userId: user.id,
      name: user.name,
      image: user.image,
      content,
      createdAt: Date.now(),
      replyTo,
    };
    const ownerUserIds = await getSiteOwnerUserIds(env.DB);
    await env.INTERACTIONS.put(commentKey(postId, comment.createdAt, id), JSON.stringify(comment));
    return json({ comment: { ...comment, ...noCommentLikes, isSiteOwner: ownerUserIds.has(user.id) } }, 201);
  }

  return json({ error: "Not found" }, 404);
}
