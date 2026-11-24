/**
 * 友链列表：给滚动容器加上下渐隐遮罩，提示还有更多条目。
 *
 * 条目在构建时全部输出，没有分页请求，也不提供自助提交。
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
