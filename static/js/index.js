function toggleMobileMenu() {
            const sideList = document.getElementById('side_list');
            const menuBtn = document.getElementById('mobile_menu_btn');
            
            if (sideList.classList.contains('active')) {
                sideList.classList.remove('active');
                menuBtn.classList.remove('active');
            } else {
                sideList.classList.add('active');
                menuBtn.classList.add('active');
            }
        }
        
        // 点击菜单外部关闭菜单
        document.addEventListener('click', function(event) {
            const sideList = document.getElementById('side_list');
            const menuBtn = document.getElementById('mobile_menu_btn');
            
            if (!sideList.contains(event.target) && !menuBtn.contains(event.target)) {
                sideList.classList.remove('active');
                menuBtn.classList.remove('active');
            }
        });

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
    }

    checkResource(url) {
        return new Promise((resolve, reject) => {
            if (url.endsWith('.ttf') || url.endsWith('.woff') || url.endsWith('.woff2')) {
                // 字体检测
                const fontName = this.getFontNameFromUrl(url);
                if (document.fonts && document.fonts.check) {
                    const checkFont = () => {
                        if (document.fonts.check('12px ' + fontName)) {
                            resolve(url);
                        } else {
                            setTimeout(checkFont, 100);
                        }
                    };
                    checkFont();
                } else {
                    // 降级处理
                    setTimeout(() => resolve(url), 1000);
                }
            } else {
                // 图片检测
                const img = new Image();
                img.onload = () => resolve(url);
                img.onerror = () => reject(url);
                img.src = url;
            }
        });
    }

    getFontNameFromUrl(url) {
        const fontMap = {
            'ZhengQingKeLengKu.ttf': 'LengKu',
            'ZiWanZhouSi.ttf': 'ZhouSi',
            'valorax-lg25v.ttf': 'valorax',
            'Technonomicon.ttf': 'Technonomicon'
        };
        
        for (const [file, name] of Object.entries(fontMap)) {
            if (url.includes(file)) {
                return name;
            }
        }
        return 'Arial';
    }

    async loadAllResources() {
        const promises = this.requiredResources.map(url => 
            this.checkResource(url).then(
                (loadedUrl) => {
                    this.loadedResources.add(loadedUrl);
                    console.log(`资源加载完成: ${loadedUrl}`);
                },
                (failedUrl) => {
                    console.warn(`资源加载失败: ${failedUrl}`);
                }
            )
        );

        try {
            await Promise.all(promises);
            console.log('所有资源加载完成');
            this.triggerAnimation();
        } catch (error) {
            console.error('资源加载过程中出现错误:', error);
            // 即使有错误也触发动画，避免永久等待
            setTimeout(() => this.triggerAnimation(), 2000);
        }
    }

    triggerAnimation() {
        const title = document.getElementById('title');
        const cover = document.getElementById('cover');
        if (title && cover) {
            title.classList.add('resources-loaded');
            cover.classList.add('resources-loaded');
        }
        if (this.onAllResourcesLoaded) {
            this.onAllResourcesLoaded();
        }
    }
}

// 移动端菜单功能
function toggleMobileMenu() {
    const sideList = document.getElementById('side_list');
    const menuBtn = document.getElementById('mobile_menu_btn');
    
    if (sideList.classList.contains('active')) {
        sideList.classList.remove('active');
        menuBtn.classList.remove('active');
    } else {
        sideList.classList.add('active');
        menuBtn.classList.add('active');
    }
}

// 初始化函数
function initializeApp() {
    const resourceManager = new ResourceLoadManager();
    
    // 等待DOM加载完成后开始检测资源
    document.addEventListener('DOMContentLoaded', () => {
        resourceManager.loadAllResources();
    });
    
    // 点击菜单外部关闭菜单
    document.addEventListener('click', function(event) {
        const sideList = document.getElementById('side_list');
        const menuBtn = document.getElementById('mobile_menu_btn');
        
        if (!sideList.contains(event.target) && !menuBtn.contains(event.target)) {
            sideList.classList.remove('active');
            menuBtn.classList.remove('active');
        }
    });
    
    return resourceManager;
}

// 导出到全局作用域
window.ResourceLoadManager = ResourceLoadManager;
window.toggleMobileMenu = toggleMobileMenu;
window.initializeApp = initializeApp;