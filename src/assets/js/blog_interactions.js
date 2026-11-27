import { onDomReady } from './dom-ready.js';

onDomReady(() => {
  const byId = (id) => document.getElementById(id);
  const panel = byId('interactionPanel');
  const postId = panel?.dataset.postId;
  if (!postId) return;
  const api = `/api/posts/${encodeURIComponent(postId)}`;
  fetch(`${api}/view`, { method: 'POST', credentials: 'omit', keepalive: true })
    .then((response) => {
      if (!response.ok) throw new Error(`阅读计数请求失败（HTTP ${response.status}）`);
    })
    .catch((error) => console.error(error));

  const commentForm = byId('commentForm');
  const commentInput = byId('commentInput');
  const submit = commentForm.querySelector('[type="submit"]');
  const commentUser = byId('commentUser');
  const commentAvatar = byId('commentAvatar');
  const commentUserName = byId('commentUserName');
  const commentList = byId('commentList');
  const commentBtn = byId('commentBtn');
  const likeBtn = byId('likeBtn');
  const loadMore = byId('loadMoreComments');
  const commentsById = new Map();
  const pendingReplies = new Set();
  const visibleReplyCount = 2;
  let commentCount = 0;
  let signedIn = false;
  let cursor = null;

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error || data?.message || `请求失败（HTTP ${response.status}）`;
      throw Object.assign(new Error(message), { status: response.status });
    }
    return response.json();
  };

  function showSession(user) {
    signedIn = Boolean(user);
    commentInput.disabled = !signedIn;
    commentInput.placeholder = signedIn ? '' : '通过 GitHub 登录后发表评论';
    submit.textContent = signedIn ? '发送' : '通过GitHub登录';
    commentUser.hidden = !signedIn;
    commentUserName.textContent = user ? user.name || 'GitHub 用户' : '';
    commentAvatar.hidden = !user?.image;
    if (user?.image) commentAvatar.src = user.image;
    else commentAvatar.removeAttribute('src');
    if (!signedIn) likeBtn.setAttribute('aria-pressed', 'false');
  }

  function actionButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cyber-control';
    button.textContent = label;
    return button;
  }

  function openReplyForm(item, comment, trigger) {
    const existing = item.querySelector(':scope > .reply-form textarea');
    if (existing) {
      existing.focus();
      return;
    }

    const form = document.createElement('form');
    form.className = 'reply-form';
    const input = document.createElement('textarea');
    input.name = 'content';
    input.required = true;
    input.maxLength = commentInput.maxLength;
    input.id = `reply-${comment.id}`;
    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = `回复 ${comment.name || 'GitHub 用户'}`;
    const actions = document.createElement('div');
    actions.className = 'reply-actions';
    const cancel = actionButton('取消');
    const send = actionButton('发送回复');
    send.type = 'submit';
    actions.append(cancel, send);
    form.append(label, input, actions);

    const close = () => {
      form.remove();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    };
    cancel.addEventListener('click', close);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!signedIn) return jumpToComments(submit);
      send.disabled = cancel.disabled = true;
      try {
        await publishComment(input.value, { id: comment.id, createdAt: comment.createdAt });
        close();
      } catch (error) {
        if (error.status === 401) {
          showSession(null);
          jumpToComments(submit);
        } else {
          console.error(error);
        }
      } finally {
        send.disabled = cancel.disabled = false;
      }
    });
    trigger.parentElement.after(form);
    trigger.setAttribute('aria-expanded', 'true');
    input.focus();
  }

  function createLikeButton(comment) {
    const button = actionButton('');
    button.classList.add('interaction-btn', 'comment-like');
    const count = document.createElement('span');
    count.setAttribute('aria-hidden', 'true');
    button.append(likeBtn.querySelector('svg').cloneNode(true), count);
    const update = ({ likes = 0, liked = false }) => {
      updateCount(button, count, '点赞', likes);
      button.setAttribute('aria-pressed', String(liked));
    };
    update(comment);
    button.addEventListener('click', async () => {
      if (!signedIn) return jumpToComments(submit);
      button.disabled = true;
      try {
        update(await request(`${api}/comments/${encodeURIComponent(comment.id)}/like`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ createdAt: comment.createdAt, liked: button.getAttribute('aria-pressed') !== 'true' }),
        }));
      } catch (error) {
        if (error.status === 401) {
          showSession(null);
          jumpToComments(submit);
        } else {
          console.error(error);
        }
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  function authorAvatar(comment) {
    const fallback = document.createElement('span');
    fallback.className = 'comment-avatar avatar-initial';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = Array.from(comment.name || 'G')[0];
    if (!comment.image) return fallback;
    const image = document.createElement('img');
    image.className = 'comment-avatar';
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.replaceWith(fallback), { once: true });
    image.src = comment.image;
    return image;
  }

  function createReplyThread(rootId) {
    const list = document.createElement('ul');
    list.id = `replies-${rootId}`;
    list.className = 'comment-replies';
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', '追评');
    const toggle = actionButton('');
    toggle.classList.add('comment-replies-toggle');
    toggle.setAttribute('aria-controls', list.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.hidden = true;
    const thread = { list, toggle, replies: [], expanded: false };
    toggle.addEventListener('click', () => {
      thread.expanded = !thread.expanded;
      updateReplyThread(thread);
    });
    return thread;
  }

  function updateReplyThread({ replies, toggle, expanded }) {
    const remaining = replies.length - visibleReplyCount;
    for (const [index, { item }] of replies.entries()) {
      item.hidden = !expanded && index >= visibleReplyCount;
    }
    toggle.hidden = remaining <= 0;
    toggle.textContent = expanded ? '收起追评' : `展开其余 ${remaining} 条追评`;
    toggle.setAttribute('aria-expanded', String(expanded));
  }

  function updateReplyNumbers({ replies }) {
    for (const [index, reply] of replies.entries()) {
      reply.number = index + 1;
      reply.heading.textContent = `${reply.comment.name || 'GitHub 用户'} #${reply.number}`;
    }
    for (const { comment, replyTarget } of replies) {
      const targetNumber = commentsById.get(comment.replyTo.id).number;
      const targetName = comment.replyTo.name || 'GitHub 用户';
      replyTarget.textContent = `>>> ${targetName}${targetNumber ? ` #${targetNumber}` : ''}`;
    }
  }

  function attachPendingReplies() {
    const changedThreads = new Set();
    for (const reply of pendingReplies) {
      // Earlier pages or a local submission may arrive before an ancestor is loaded.
      let parent = commentsById.get(reply.comment.replyTo.id);
      while (parent && !parent.thread) {
        parent = commentsById.get(parent.comment.replyTo.id);
      }
      if (!parent) continue;

      const thread = parent.thread;
      const { createdAt, id } = reply.comment;
      const index = thread.replies.findIndex(({ comment }) =>
        comment.createdAt > createdAt || (comment.createdAt === createdAt && comment.id > id));
      if (index === -1) {
        thread.replies.push(reply);
        thread.list.append(reply.item);
      } else {
        thread.list.insertBefore(reply.item, thread.replies[index].item);
        thread.replies.splice(index, 0, reply);
      }
      reply.thread = thread;
      pendingReplies.delete(reply);
      changedThreads.add(thread);
    }
    for (const thread of changedThreads) {
      updateReplyNumbers(thread);
      updateReplyThread(thread);
    }
  }

  function revealReply(record) {
    if (record?.item.hidden && record.thread) {
      record.thread.expanded = true;
      updateReplyThread(record.thread);
    }
  }

  function renderComments(comments) {
    for (const comment of comments) {
      if (commentsById.has(comment.id)) continue;
      const item = document.createElement('li');
      item.id = `comment-${comment.id}`;
      item.tabIndex = -1;
      const author = document.createElement('div');
      author.className = 'comment-author';
      const heading = document.createElement('strong');
      heading.textContent = comment.name || 'GitHub 用户';
      author.append(authorAvatar(comment), heading);
      if (comment.isSiteOwner) {
        const badge = document.createElement('span');
        badge.className = 'comment-owner-badge';
        badge.textContent = '站长';
        author.append(badge);
      }
      let replyTarget = null;
      if (comment.replyTo) {
        replyTarget = document.createElement('span');
        replyTarget.className = 'comment-reply-target';
        author.append(replyTarget);
      }
      const body = document.createElement('p');
      body.textContent = comment.content;
      const time = document.createElement('time');
      time.dateTime = new Date(comment.createdAt).toISOString();
      time.textContent = new Date(comment.createdAt).toLocaleString();
      const actions = document.createElement('div');
      actions.className = 'comment-item-actions';
      const reply = actionButton('回复');
      reply.setAttribute('aria-expanded', 'false');
      reply.addEventListener('click', () => {
        if (!signedIn) return jumpToComments(submit);
        openReplyForm(item, comment, reply);
      });
      actions.append(time, reply, createLikeButton(comment));
      item.append(author, body, actions);
      const record = { comment, item, heading, replyTarget, number: null, thread: null };
      commentsById.set(comment.id, record);
      if (comment.replyTo) {
        pendingReplies.add(record);
      } else {
        record.thread = createReplyThread(comment.id);
        item.append(record.thread.list, record.thread.toggle);
        commentList.append(item);
      }
    }
    attachPendingReplies();
  }

  function updateCount(button, count, label, value) {
    count.textContent = String(value);
    button.setAttribute('aria-label', `${label}（${value}）`);
    button.title = button.getAttribute('aria-label');
  }

  function updateLike(data) {
    updateCount(likeBtn, byId('likeCount'), '点赞', data.likes);
    likeBtn.setAttribute('aria-pressed', String(data.liked));
  }

  function showCommentCount() {
    updateCount(commentBtn, byId('commentCount'), '跳转到评论', commentCount);
  }

  async function loadInteractions(next = false) {
    const query = next ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const data = await request(`${api}${query}`);
    cursor = data.cursor;
    loadMore.hidden = !cursor;
    if (!next) {
      updateLike(data);
      commentCount = data.commentCount;
      showCommentCount();
    }
    renderComments(data.comments);
  }

  loadMore.addEventListener('click', async () => {
    loadMore.disabled = true;
    try {
      await loadInteractions(true);
    } catch (error) {
      console.error(error);
    } finally {
      loadMore.disabled = false;
    }
  });

  function jumpToComments(target = panel) {
    target.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'start' });
  }

  likeBtn.addEventListener('click', async () => {
    likeBtn.disabled = true;
    try {
      const data = await request(`${api}/like`, { method: 'POST' });
      updateLike(data);
    } catch (error) {
      if (error.status === 401) {
        showSession(null);
        jumpToComments(submit);
      } else {
        console.error(error);
      }
    } finally {
      likeBtn.disabled = false;
    }
  });

  commentBtn.addEventListener('click', () => jumpToComments());

  async function publishComment(content, replyTo) {
    const { comment } = await request(`${api}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, replyTo }),
    });
    if (!commentsById.has(comment.id)) {
      renderComments([comment]);
      commentCount += 1;
      showCommentCount();
    }
    if (replyTo) revealReply(commentsById.get(comment.id));
  }

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      if (!signedIn) {
        const callbackURL = new URL(location.href);
        callbackURL.hash = panel.id;
        const { url } = await request('/api/auth/sign-in/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'github', callbackURL: callbackURL.href }),
        });
        if (!url) throw new Error('GitHub 登录未能启动，请重试');
        location.assign(url);
        return;
      }
      await publishComment(commentInput.value);
      commentForm.reset();
    } catch (error) {
      if (error.status === 401) {
        showSession(null);
      } else {
        console.error(error);
      }
    } finally {
      submit.disabled = false;
    }
  });

  loadInteractions().catch((error) => {
    console.error(error);
  }).finally(async () => {
    try {
      const data = await request('/api/auth/get-session');
      showSession(data?.user);
    } catch (error) {
      console.error(error);
    } finally {
      submit.disabled = false;
    }
  });
});
