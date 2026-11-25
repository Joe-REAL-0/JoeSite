import { createAuth } from "./auth.js";

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

const commentKey = (postId, timestamp, id) => `comments:${postId}:${timestamp}:${id}`;
const likeKey = (postId, userId) => `likes:${postId}:${userId}`;

function validPostId(value) {
  return typeof value === "string" && /^\d{1,12}$/.test(value);
}

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

export async function handleInteractionRequest(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "posts" || !validPostId(parts[2])) {
    return json({ error: "Not found" }, 404);
  }
  const postId = parts[2];
  if (!env.INTERACTIONS) return json({ error: "Interactions storage unavailable" }, 503);

  if (parts.length === 3 && request.method === "GET") {
    const prefix = `comments:${postId}:`;
    const listed = await env.INTERACTIONS.list({ prefix, limit: 50, cursor: url.searchParams.get("cursor") || undefined });
    const comments = await Promise.all(listed.keys.map(async ({ name }) => env.INTERACTIONS.get(name, "json")));
    const user = await getUser(request, env);
    const liked = user ? await env.INTERACTIONS.get(likeKey(postId, user.id)) === "1" : false;
    return json({
      likes: await getLikeCount(env.INTERACTIONS, postId),
      liked,
      comments: comments.filter(Boolean).sort((a, b) => a.createdAt - b.createdAt),
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

  if (parts[3] === "comments" && request.method === "POST") {
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
    const id = crypto.randomUUID();
    const comment = {
      id,
      userId: user.id,
      name: user.name,
      image: user.image,
      content,
      createdAt: Date.now(),
    };
    await env.INTERACTIONS.put(commentKey(postId, comment.createdAt, id), JSON.stringify(comment));
    return json({ comment }, 201);
  }

  return json({ error: "Not found" }, 404);
}
