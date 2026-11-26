import { onDomReady } from './dom-ready.js';

/**
 * 档案馆：移动端侧栏折叠 + 目录当前项高亮。
 *
 * 正文与目录都在构建时生成，禁用本脚本也能通过普通锚点跳转；这里只做增强。
 */
onDomReady(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) document.body.classList.add('mobile-device');

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const titleItems = Array.prototype.slice.call(document.querySelectorAll('.TextTitle'));

    const syncActive = () => {
        const current = titleItems.find((item) => item.hash === window.location.hash) || titleItems[0];
        titleItems.forEach((item) => {
            const active = item === current;
            item.classList.toggle('active', active);
            if (active) item.setAttribute('aria-current', 'true');
            else item.removeAttribute('aria-current');
        });
    };

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function () {
            const expanded = sidebar.classList.toggle('expanded');
            this.setAttribute('aria-expanded', String(expanded));
            this.textContent = expanded ? '✕' : '☰';
        });
    }

    // 点击目录后在移动端收起侧栏；锚点跳转由浏览器完成。
    titleItems.forEach((item) => {
        item.addEventListener('click', function () {
            if (window.matchMedia('(max-width: 768px)').matches && sidebar.classList.contains('expanded')) {
                sidebar.classList.remove('expanded');
                sidebarToggle.textContent = '☰';
                sidebarToggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    syncActive();
    window.addEventListener('hashchange', syncActive);
});
