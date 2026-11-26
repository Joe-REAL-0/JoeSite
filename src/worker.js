import { createAuth } from "./lib/auth.js";
import { handleInteractionRequest } from "./lib/interactions.js";
import { handleFriendLinkRequest } from "./lib/friend-links.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/auth/")) {
      return createAuth(env, request.url).handler(request);
    }
    if (url.pathname.startsWith("/api/posts/")) {
      return handleInteractionRequest(request, env);
    }
    if (url.pathname.startsWith("/api/friend-links/")) {
      return handleFriendLinkRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
