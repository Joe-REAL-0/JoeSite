/**
 * 博客详情：目录折叠、当前标题高亮、回到顶部。
 *
 * 目录由构建时生成，链接本身就是锚点；脚本只负责折叠与高亮，禁用后仍可跳转。
 */
document.addEventListener('DOMContentLoaded', function () {
    const tocToggle = document.getElementById('tocToggle');
    const tocSection = document.getElementById('tocSection');
    const tocContent = document.getElementById('tocContent');

    if (tocToggle && tocSection) {
        tocToggle.addEventListener('click', function () {
            const collapsed = tocSection.classList.toggle('collapsed');
            this.setAttribute('aria-expanded', String(!collapsed));
            this.textContent = collapsed ? '▼' : '▲';
            this.title = collapsed ? '展开目录' : '收起目录';
        });
    }

    // 滚动时高亮当前标题
    const headings = Array.prototype.slice.call(document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3'));

    if (tocContent && headings.length) {
        const items = Array.prototype.slice.call(tocContent.querySelectorAll('.toc-item'));
        const offset = 120;

        const updateActiveHeading = () => {
            let current = null;
            headings.forEach((heading) => {
                if (heading.getBoundingClientRect().top <= offset + 40) current = heading;
            });

            items.forEach((item) => {
                const active = current && item.getAttribute('href') === '#' + current.id;
                item.classList.toggle('active', Boolean(active));
            });
        };

        let frame = 0;
        window.addEventListener('scroll', () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                updateActiveHeading();
            });
        }, { passive: true });
        updateActiveHeading();
    }

    const topBtn = document.getElementById('topBtn');
    if (topBtn) {
        topBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
