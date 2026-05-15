// 资源加载检测
class ResourceLoadManager {
    constructor() {
        this.loadedResources = new Set();
        this.totalResources = 0;
        this.requiredResources = [];
        this.onAllResourcesLoaded = null;
    }

    // 设置需要检测的资源列表
    setRequiredResources(resources) {
        this.requiredResources = resources;
        this.totalResources = resources.length;
        
        // 立即开始加载资源
        this.loadAllResources();
    }

    checkResource(url) {
        return new Promise((resolve, reject) => {
            // 设置10秒超时
            const timeout = setTimeout(() => {
                resolve(url); // 超时也算成功，避免卡住
            }, 10000);

            if (url.endsWith('.ttf') || url.endsWith('.woff') || url.endsWith('.woff2')) {
                // 字体检测
                const fontName = this.getFontNameFromUrl(url);
                
                // 改进的字体检测方法
                if (document.fonts && document.fonts.load) {
                    // 使用FontFace API加载字体
                    document.fonts.load(`16px "${fontName}"`).then(() => {
                        clearTimeout(timeout);
                        resolve(url);
                    }).catch(() => {
                        // 如果FontFace API失败，使用传统检测方法
                        this.fallbackFontCheck(fontName, url, timeout, resolve);
                    });
                } else {
                    // 浏览器不支持FontFace API，使用传统检测方法
                    this.fallbackFontCheck(fontName, url, timeout, resolve);
                }
            } else {
                // 图片检测
                const img = new Image();
                
                img.onload = () => {
                    clearTimeout(timeout);
                    resolve(url);
                };
                
                img.onerror = (error) => {
                    clearTimeout(timeout);
                    resolve(url); // 即使失败也resolve，避免阻塞
                };
                
                img.src = url;
            }
        });
    }

    fallbackFontCheck(fontName, url, timeout, resolve) {
        if (document.fonts && document.fonts.check) {
            let checkCount = 0;
            const maxChecks = 30; // 减少到3秒
            
            const checkFont = () => {
                checkCount++;
                // 尝试多种字体大小检测
                const sizes = ['12px', '16px', '20px'];
                const isLoaded = sizes.some(size => 
                    document.fonts.check(`${size} "${fontName}"`) ||
                    document.fonts.check(`${size} ${fontName}`)
                );
                
                if (isLoaded) {
                    clearTimeout(timeout);
                    resolve(url);
                } else if (checkCount >= maxChecks) {
                    clearTimeout(timeout);
                    resolve(url);
                } else {
                    setTimeout(checkFont, 100);
                }
            };
            checkFont();
        } else {
            // 浏览器不支持字体检测，直接等待1秒
            setTimeout(() => {
                clearTimeout(timeout);
                resolve(url);
            }, 1000);
        }
    }

    getFontNameFromUrl(url) {
        const fontMap = {
            'ZhengQingKeLengKu.ttf': 'LengKu',
            'valorax-lg25v.ttf': 'valorax',
            'Technonomicon.ttf': 'Technonomicon',
            'GunShi.ttf': 'GunShi'
        };
        
        for (const [file, name] of Object.entries(fontMap)) {
            if (url.includes(file)) {
                return name;
            }
        }
        return 'Arial';
    }

    async loadAllResources() {
        if (this.requiredResources.length === 0) {
            this.triggerAnimation();
            return;
        }
        
        let completedCount = 0;
        const promises = this.requiredResources.map((url, index) => 
            this.checkResource(url).then(
                (loadedUrl) => {
                    this.loadedResources.add(loadedUrl);
                    completedCount++;
                    return loadedUrl;
                },
                (failedUrl) => {
                    completedCount++;
                    return failedUrl; // 返回失败的URL以继续处理
                }
            ).catch(error => {
                completedCount++;
                return url; // 即使异常也返回URL继续处理
            })
        );

        try {
            const results = await Promise.allSettled(promises); // 使用allSettled代替all
            
            // 不管成功失败都触发动画
            this.triggerAnimation();
        } catch (error) {
            // 即使有错误也触发动画，避免永久等待
            setTimeout(() => this.triggerAnimation(), 2000);
        }
        
        // 备用机制：如果15秒内没有触发动画，强制触发
        setTimeout(() => {
            const title = document.getElementById('title');
            if (title && !title.classList.contains('resources-loaded')) {
                this.triggerAnimation();
            }
        }, 15000);
    }

    triggerAnimation() {
        const title_container = document.getElementById('title_container');
        const title = document.getElementById('title');
        const cover = document.getElementById('cover');
        const loadingText = document.getElementById('loading_text');
        
        // 检测是否为iOS设备
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (title && cover && loadingText) {
            // 如果是iOS设备，添加特殊类
            if (isIOS) {
                title.classList.add('ios-device');
                document.body.classList.add('ios-device');
            }

            title_container.classList.add('resources-loaded');
            title.classList.add('resources-loaded');
            cover.classList.add('resources-loaded');
            loadingText.classList.add('resources-loaded');
        }

        // Hero 首屏内容入场
        const heroContent = document.getElementById('hero_content');
        const linkColumn = document.getElementById('link_column');
        const scrollIndicator = document.getElementById('scroll_indicator');

        if (heroContent) heroContent.classList.add('loaded');
        if (linkColumn) linkColumn.classList.add('loaded');
        if (scrollIndicator) scrollIndicator.classList.add('loaded');

        // 触发欢迎语动画
        setTimeout(() => {
            this.triggerWelcomeMessages();
        }, 1000);

        // 入场动画完成后，启用 section 切换的淡入淡出过渡
        // hero-content: 0.8s delay + 0.8s animation = 1.6s
        setTimeout(() => {
            if (heroContent) heroContent.classList.add('section-fade-ready');
            const mainScreen = document.getElementById('main_screen');
            if (mainScreen) mainScreen.classList.add('section-fade-ready');
        }, 1800);

        // 设置 IntersectionObserver 监听第二屏
        this.setupScrollObserver();

        if (this.onAllResourcesLoaded) {
            this.onAllResourcesLoaded();
        }
    }

    triggerWelcomeMessages() {
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

    setupScrollObserver() {
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
}

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

// 初始化函数
function initializeApp() {
    const resourceManager = new ResourceLoadManager();
    
    // 设置滚动指示器
    setupScrollIndicator();
    
    return resourceManager;
}

// 导出到全局作用域
window.ResourceLoadManager = ResourceLoadManager;
window.initializeApp = initializeApp;