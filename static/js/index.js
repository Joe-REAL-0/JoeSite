// 首页只在公共加载器完成后显现；公共标题、遮罩和角色显现逻辑保持不变。
function initializeHomePage() {
    const trigger = document.getElementById('home_menu_trigger');
    const menu = document.getElementById('home_menu');
    if (trigger && menu) {
        trigger.addEventListener('click', () => {
            if (!menu.open) {
                menu.showModal();
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
        menu.addEventListener('close', () => {
            trigger.setAttribute('aria-expanded', 'false');
            if (trigger.getClientRects().length) trigger.focus();
        });
        menu.addEventListener('click', event => {
            if (event.target !== menu) return;
            const rect = menu.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom) menu.close();
        });
        const compactLayout = window.matchMedia('(max-width: 1024px), (max-height: 700px), (max-aspect-ratio: 3/2)');
        compactLayout.addEventListener('change', event => {
            if (!event.matches && menu.open) menu.close();
        });
    }
    window.globalLoader.onReady(() => document.body.classList.add('home-ready'));
}
window.initializeHomePage = initializeHomePage;
