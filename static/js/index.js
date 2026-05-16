// 首页特有逻辑
// ResourceLoadManager 已移至 global-loader.js

// 滚动指示器点击处理
function setupScrollIndicator() {
    const scrollIndicator = document.getElementById('scroll_indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const contentSection = document.getElementById('content_section');
            if (contentSection) {
                contentSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// 欢迎语动画
function triggerWelcomeMessages() {
    const welcomeMessage1 = document.getElementById('welcome_message_1');
    const welcomeMessage2 = document.getElementById('welcome_message_2');

    if (welcomeMessage1) {
        welcomeMessage1.classList.add('welcome-start');
    }
    
    if (welcomeMessage2) {
        // 第2行延迟出现
        setTimeout(() => {
            welcomeMessage2.classList.add('welcome-start');
        }, 500);
    }
}

// 设置 IntersectionObserver 监听第二屏
function setupScrollObserver() {
    const heroSection = document.getElementById('hero_section');
    const contentSection = document.getElementById('content_section');
    const heroContent = document.getElementById('hero_content');
    const mainScreen = document.getElementById('main_screen');

    if (!heroSection || !contentSection || !heroContent || !mainScreen) return;

    let contentLoaded = false;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 进入视口 → 对应内容容器淡入
                if (entry.target === heroSection) {
                    heroContent.classList.remove('section-fade-out');
                } else if (entry.target === contentSection) {
                    mainScreen.classList.remove('section-fade-out');
                    // 第二屏首次进入时触发内容入场动画
                    if (!contentLoaded) {
                        mainScreen.classList.add('loaded');
                        contentLoaded = true;
                    }
                }
            } else {
                // 离开视口 → 对应内容容器淡出
                if (entry.target === heroSection) {
                    heroContent.classList.add('section-fade-out');
                } else if (entry.target === contentSection) {
                    mainScreen.classList.add('section-fade-out');
                }
            }
        });
    }, { threshold: 0.15 });

    observer.observe(heroSection);
    observer.observe(contentSection);
}

// 首页初始化 — 注册到全局加载器的回调中
function initializeHomePage() {
    // 设置滚动指示器
    setupScrollIndicator();

    // 注册加载完成后的回调
    window.globalLoader.onReady(() => {
        // Hero 首屏内容入场
        const heroContent = document.getElementById('hero_content');
        const linkColumn = document.getElementById('link_column');
        const scrollIndicator = document.getElementById('scroll_indicator');

        if (heroContent) heroContent.classList.add('loaded');
        if (linkColumn) linkColumn.classList.add('loaded');
        if (scrollIndicator) scrollIndicator.classList.add('loaded');

        // 触发欢迎语动画
        setTimeout(() => {
            triggerWelcomeMessages();
        }, 200);

        // 入场动画完成后，启用 section 切换的淡入淡出过渡
        setTimeout(() => {
            if (heroContent) heroContent.classList.add('section-fade-ready');
            const mainScreen = document.getElementById('main_screen');
            if (mainScreen) mainScreen.classList.add('section-fade-ready');
        }, 1000);

        // 设置 IntersectionObserver 监听第二屏
        setupScrollObserver();
    });
}

// 导出到全局作用域
window.initializeHomePage = initializeHomePage;