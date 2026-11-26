/**
 * 友链列表：给滚动容器加上下渐隐遮罩，提示还有更多条目。
 *
 * 条目在构建时输出，申请入口复用本站 GitHub 会话。
 */
(function () {
    'use strict';

    function updateScrollMask() {
        const container = document.getElementById('friend_link_container');
        const wrapper = document.getElementById('friend_link_container_wrapper');
        if (!container || !wrapper) return;

        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        const isTop = scrollTop <= 0;
        const isBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;

        let mask = 'linear-gradient(to bottom, ';
        mask += isTop ? '#000 0%, #000 ' : 'transparent 0%, transparent 15px, #000 60px, #000 ';
        mask += isBottom
            ? '100%, #000 100%)'
            : 'calc(100% - 60px), transparent calc(100% - 15px), transparent 100%)';

        wrapper.style.webkitMaskImage = mask;
        wrapper.style.maskImage = mask;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const applyLink = document.getElementById('apply_friend_link');
        const status = document.getElementById('friend_login_status');
        applyLink?.addEventListener('click', async (event) => {
            event.preventDefault();
            if (applyLink.getAttribute('aria-busy') === 'true') return;
            applyLink.setAttribute('aria-busy', 'true');
            status.textContent = '正在检查 GitHub 登录状态…';
            try {
                const session = await fetch('/api/friend-links/session', { credentials: 'same-origin', cache: 'no-store' });
                if (session.ok) {
                    location.assign(applyLink.href);
                    return;
                }
                if (session.status !== 401) throw new Error('暂时无法检查登录状态，请稍后重试');
                const response = await fetch('/api/auth/sign-in/social', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: 'github', callbackURL: applyLink.href }),
                });
                const data = await response.json();
                if (!response.ok || !data.url) throw new Error('GitHub 登录未能启动，请重试');
                location.assign(data.url);
            } catch (error) {
                status.textContent = error.message;
            } finally {
                applyLink.removeAttribute('aria-busy');
            }
        });
        const container = document.getElementById('friend_link_container');
        if (!container) return;

        const mobile = window.matchMedia('(max-width: 768px)').matches;
        document.documentElement.classList.add(mobile ? 'mobile-device' : 'desktop-device');

        container.addEventListener('scroll', updateScrollMask, { passive: true });
        window.addEventListener('resize', updateScrollMask, { passive: true });

        if (window.ResizeObserver) {
            new ResizeObserver(updateScrollMask).observe(container);
        }

        updateScrollMask();
    });
})();
