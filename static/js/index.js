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
        const title = document.getElementById('title');
        const cover = document.getElementById('cover');
        const loadingText = document.getElementById('loading_text');
        const mobileMenuBtn = document.getElementById('mobile_menu_btn');
        
        if (title && cover && loadingText) {
            title.classList.add('resources-loaded');
            cover.classList.add('resources-loaded');
            loadingText.classList.add('resources-loaded');
            
            // 资源加载完成后，将菜单按钮的z-index提高
            if (mobileMenuBtn) {
                setTimeout(() => {
                    mobileMenuBtn.classList.add('resources-loaded');
                }, 400); // 等待cover动画完成后再添加类
            }
        }

        const mainScreen = document.getElementById('main_screen');
        const sideList = document.getElementById('side_list');
        const infoScreen = document.getElementById('info_screen');
        const linkColumn = document.getElementById('link_column');
        const userInfo = document.getElementById('user_info');

        if (mainScreen && sideList && infoScreen && linkColumn && userInfo) {
            mainScreen.classList.add('loaded');
            sideList.classList.add('loaded');
            infoScreen.classList.add('loaded');
            linkColumn.classList.add('loaded');
            userInfo.classList.add('loaded');
        }

        setTimeout(() => {
            this.triggerWelcomeMessages();
        }, 1200);

        if (this.onAllResourcesLoaded) {
            this.onAllResourcesLoaded();
        }
    }

    triggerWelcomeMessages() {
        const welcomeMessage1 = document.getElementById('welcome_message_1');
        const welcomeMessage2 = document.getElementById('welcome_message_2');
        const welcomeMessage3 = document.getElementById('welcome_message_3');
        const welcomeMessage4 = document.getElementById('welcome_message_4');

        if (welcomeMessage1 && welcomeMessage2 && welcomeMessage3 && welcomeMessage4) {
            // 第一组：第1行和第3行同时开始
            welcomeMessage1.classList.add('welcome-start');
            welcomeMessage3.classList.add('welcome-start');
            
            // 第二组：第2行和第4行稍晚开始（延迟800ms）
            setTimeout(() => {
                welcomeMessage2.classList.add('welcome-start');
                welcomeMessage4.classList.add('welcome-start');
            }, 800);
        }
    }
}

// 移动端菜单功能
function toggleMobileMenu(event) {
    const sideList = document.getElementById('side_list');
    const menuBtn = document.getElementById('mobile_menu_btn');
    const infoScreen = document.getElementById('info_screen');
    const userInfo = document.getElementById('user_info');
    
    if (sideList.classList.contains('active')) {
        // 添加关闭动画类
        sideList.classList.add('closing');
        menuBtn.classList.remove('active');
        
        // 恢复其他元素的可见性
        if (infoScreen) infoScreen.style.visibility = '';
        if (userInfo) userInfo.style.visibility = '';
        
        // 等待动画结束后移除活动类
        setTimeout(() => {
            sideList.classList.remove('active');
            sideList.classList.remove('closing');
        }, 300); // 时间与动画持续时间一致
    } else {
        // 隐藏其他元素，但不隐藏main_screen
        if (infoScreen) infoScreen.style.visibility = 'hidden';
        if (userInfo) userInfo.style.visibility = 'hidden';
        
        // 激活侧边栏
        sideList.classList.add('active');
        menuBtn.classList.add('active');
    }
    
    // 阻止事件冒泡，避免点击按钮时触发document的click事件
    if (event) {
        event.stopPropagation();
    }
}

// 初始化函数
function initializeApp() {
    const resourceManager = new ResourceLoadManager();
    
    // 点击菜单外部关闭菜单
    document.addEventListener('click', function(event) {
        const sideList = document.getElementById('side_list');
        const menuBtn = document.getElementById('mobile_menu_btn');
        const infoScreen = document.getElementById('info_screen');
        const userInfo = document.getElementById('user_info');
        
        if (sideList && menuBtn && sideList.classList.contains('active') && !sideList.contains(event.target) && !menuBtn.contains(event.target)) {
            // 添加关闭动画类
            sideList.classList.add('closing');
            menuBtn.classList.remove('active');
            
            // 恢复其他元素的可见性
            if (infoScreen) infoScreen.style.visibility = '';
            if (userInfo) userInfo.style.visibility = '';
            
            // 等待动画结束后移除活动类
            setTimeout(() => {
                sideList.classList.remove('active');
                sideList.classList.remove('closing');
            }, 300); // 时间与动画持续时间一致
        }
    });
    
    return resourceManager;
}

// 导出到全局作用域
window.ResourceLoadManager = ResourceLoadManager;
window.toggleMobileMenu = toggleMobileMenu;
window.initializeApp = initializeApp;