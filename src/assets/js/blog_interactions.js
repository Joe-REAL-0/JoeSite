import { onDomReady } from './dom-ready.js';

onDomReady(() => {
  const byId = (id) => document.getElementById(id);
  const panel = byId('interactionPanel');
  const postId = panel?.dataset.postId;
  if (!postId) return;
  const api = `/api/posts/${encodeURIComponent(postId)}`;
  const status = byId('interactionStatus');
  const loginBtn = byId('loginBtn');
  const commentForm = byId('commentForm');
  const commentList = byId('commentList');
  let signedIn = false;
  let cursor = null;

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '请求失败');
    return data;
  };

  async function refreshSession() {
    const data = await request('/api/auth/get-session');
    signedIn = Boolean(data);
    loginBtn.textContent = signedIn ? `已登录：${data.user.name}（退出）` : '使用 GitHub 登录';
    commentForm.hidden = !signedIn;
  }

  function renderComments(comments, append = false) {
    if (!append) commentList.replaceChildren();
    for (const comment of comments) {
      const item = document.createElement('li');
      const heading = document.createElement('strong');
      heading.textContent = comment.name || 'GitHub 用户';
      const body = document.createElement('p');
      body.textContent = comment.content;
      const time = document.createElement('time');
      time.dateTime = new Date(comment.createdAt).toISOString();
      time.textContent = new Date(comment.createdAt).toLocaleString();
      item.append(heading, body, time);
      commentList.append(item);
    }
  }

  async function loadInteractions(append = false) {
    const query = append && cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const data = await request(`${api}${query}`);
    cursor = data.cursor;
    byId('loadMoreComments').hidden = !cursor;
    byId('likeCount').textContent = String(data.likes);
    byId('likeBtn').setAttribute('aria-pressed', String(data.liked));
    renderComments(data.comments, append);
  }

  byId('loadMoreComments').addEventListener('click', () => {
    loadInteractions(true).catch((error) => { status.textContent = error.message; });
  });

  loginBtn.addEventListener('click', async () => {
    try {
      if (signedIn) await request('/api/auth/sign-out', { method: 'POST' });
      else {
        const response = await request('/api/auth/sign-in/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'github', callbackURL: location.href }),
        });
        if (response.url) location.assign(response.url);
      }
      await refreshSession();
    } catch (error) {
      status.textContent = error.message;
    }
  });

  byId('likeBtn').addEventListener('click', async () => {
    try {
      const data = await request(`${api}/like`, { method: 'POST' });
      byId('likeCount').textContent = String(data.likes);
      byId('likeBtn').setAttribute('aria-pressed', String(data.liked));
    } catch (error) {
      status.textContent = error.message === 'Unauthorized' ? '请先使用 GitHub 登录后点赞。' : error.message;
      panel.hidden = false;
    }
  });

  byId('commentBtn').addEventListener('click', () => { panel.hidden = false; });
  byId('closeComments').addEventListener('click', () => { panel.hidden = true; });

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = commentForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await request(`${api}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: new FormData(commentForm).get('content') }),
      });
      commentForm.reset();
      await loadInteractions();
      status.textContent = '评论已发布';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  Promise.all([refreshSession(), loadInteractions()]).catch((error) => {
    status.textContent = error.message;
  });
});
