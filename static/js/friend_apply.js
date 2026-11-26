(() => {
  const byId = (id) => document.getElementById(id);
  const form = byId('friend-apply-form');
  const fields = byId('apply-fields');
  const login = byId('apply-login');
  const sessionStatus = byId('apply-session-status');
  const result = byId('apply-result');
  const fileInput = byId('friend-avatar');
  const preview = byId('avatar-preview');
  const editor = byId('avatar-editor');
  const canvas = byId('avatar-crop');
  const context = canvas.getContext('2d');
  const zoomInput = byId('avatar-zoom');
  const reset = byId('avatar-reset');
  let githubAvatar = '';
  let image = null;
  let imageLoading = false;
  let imageVersion = 0;
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let pointer = null;
  let applicationId = crypto.randomUUID();

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || '请求失败，请稍后重试');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function signIn() {
    login.disabled = true;
    sessionStatus.textContent = '正在前往 GitHub 登录…';
    try {
      const data = await request('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'github', callbackURL: new URL('/friend_link/apply/', location.origin).href }),
      });
      if (!data.url) throw new Error('GitHub 登录未能启动，请重试');
      location.assign(data.url);
    } catch (error) {
      sessionStatus.textContent = error.message;
      login.hidden = false;
    } finally {
      login.disabled = false;
    }
  }

  function drawCrop() {
    if (!image) return;
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    offsetX = Math.max((canvas.width - width) / 2, Math.min((width - canvas.width) / 2, offsetX));
    offsetY = Math.max((canvas.height - height) / 2, Math.min((height - canvas.height) / 2, offsetY));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (canvas.width - width) / 2 + offsetX, (canvas.height - height) / 2 + offsetY, width, height);
    preview.src = canvas.toDataURL('image/png');
  }

  fileInput.addEventListener('change', async () => {
    const version = ++imageVersion;
    const file = fileInput.files[0];
    if (!file) return;
    result.textContent = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      result.textContent = '请选择不超过 5 MiB 的 PNG、JPEG 或 WebP 图片';
      fileInput.value = '';
      return;
    }
    imageLoading = true;
    byId('apply-submit').disabled = true;
    const objectUrl = URL.createObjectURL(file);
    try {
      const nextImage = new Image();
      nextImage.src = objectUrl;
      await nextImage.decode();
      if (version !== imageVersion) return;
      if (nextImage.naturalWidth * nextImage.naturalHeight > 16000000) throw new Error('图片不能超过 1600 万像素');
      image = nextImage;
      offsetX = 0;
      offsetY = 0;
      zoom = 1;
      zoomInput.value = '1';
      editor.hidden = false;
      reset.hidden = false;
      byId('avatar-source').textContent = '使用当前裁切的头像';
      drawCrop();
    } catch (error) {
      if (version === imageVersion) {
        result.textContent = error.message === '图片不能超过 1600 万像素' ? error.message : '无法读取图片，请选择其他图片';
        fileInput.value = '';
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (version === imageVersion) {
        imageLoading = false;
        byId('apply-submit').disabled = false;
      }
    }
  });

  reset.addEventListener('click', () => {
    imageVersion += 1;
    imageLoading = false;
    image = null;
    pointer = null;
    fileInput.value = '';
    editor.hidden = true;
    applicationId = crypto.randomUUID();
    reset.hidden = true;
    preview.src = githubAvatar;
    byId('apply-submit').disabled = false;
    byId('avatar-source').textContent = '未上传时使用 GitHub 头像。支持 PNG、JPEG、WebP，最大 5 MiB。';
  });
  zoomInput.addEventListener('input', () => {
    zoom = Number(zoomInput.value);
    drawCrop();
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (!image) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    offsetX += (event.clientX - pointer.x) * canvas.width / bounds.width;
    offsetY += (event.clientY - pointer.y) * canvas.height / bounds.height;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    drawCrop();
  });
  canvas.addEventListener('lostpointercapture', () => { pointer = null; });
  canvas.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] };
    if (!image || !moves[event.key]) return;
    event.preventDefault();
    offsetX += moves[event.key][0];
    offsetY += moves[event.key][1];
    drawCrop();
  });

  login.addEventListener('click', signIn);
  form.addEventListener('input', () => { applicationId = crypto.randomUUID(); });
  form.addEventListener('change', () => { applicationId = crypto.randomUUID(); });
  canvas.addEventListener('pointerup', () => { applicationId = crypto.randomUUID(); });
  canvas.addEventListener('keydown', () => { applicationId = crypto.randomUUID(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (fields.disabled || imageLoading) return;
    fields.disabled = true;
    result.textContent = '正在提交申请并发送审核邮件…';
    try {
      const data = await request('/api/friend-links/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: applicationId,
          name: byId('friend-name').value.trim(),
          url: byId('friend-url').value.trim(),
          avatar: image ? canvas.toDataURL('image/png') : null,
        }),
      });
      form.hidden = true;
      result.textContent = `申请已提交，等待站主审核。申请编号 ${data.id}`;
    } catch (error) {
      result.textContent = error.message;
      if (error.status === 401) {
        form.hidden = true;
        login.hidden = false;
        sessionStatus.textContent = '登录已过期，请重新使用 GitHub 登录';
      }
    } finally {
      fields.disabled = false;
    }
  });

  (async () => {
    try {
      const data = await request('/api/friend-links/session');
      githubAvatar = data.user.image;
      preview.src = githubAvatar;
      byId('friend-name').value = data.user.name;
      sessionStatus.textContent = `已使用 GitHub 登录 · ${data.user.name}`;
      form.hidden = false;
    } catch (error) {
      sessionStatus.textContent = error.message;
      login.hidden = false;
      if (error.status === 401) await signIn();
    }
  })();
})();
