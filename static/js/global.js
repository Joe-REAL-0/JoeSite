/**
 * 全局资源加载管理器
 * 负责加载遮罩(cover)、标题(title)动画和资源加载检测。
 * 从 index.js 提取，作为全局共享逻辑。
 * 
 * 使用方式：
 *   1. 在页面中调用 window.globalLoader.start(resources) 开始加载
 *   2. 注册 window.globalLoader.onReady(callback) 来在加载完成后执行页面特有逻辑
 */
class GlobalResourceLoader {
    constructor() {
        this.loadedResources = new Set();
        this.totalResources = 0;
        this.requiredResources = [];
        this._readyCallbacks = [];
        this._triggered = false;
    }

    /**
     * 注册加载完成后的回调
     * @param {Function} callback 
     */
    onReady(callback) {
        if (this._triggered) {
            // 如果已经加载完成，直接执行
            callback();
        } else {
            this._readyCallbacks.push(callback);
        }
    }

    /**
     * 设置资源列表并开始加载
     * @param {string[]} resources - 资源URL列表
     */
    start(resources) {
        this.requiredResources = resources;
        this.totalResources = resources.length;
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
            'GunShi.otf': 'GunShi'
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
            const titleH1 = document.querySelector('#title_container h1');
            if (titleH1 && !titleH1.classList.contains('resources-loaded')) {
                this.triggerAnimation();
            }
        }, 15000);
    }

    triggerAnimation() {
        if (this._triggered) return; // 防止重复触发
        this._triggered = true;

        const title_container = document.getElementById('title_container');
        const titleH1 = document.querySelector('#title_container h1');
        const cover = document.getElementById('cover');
        const loadingText = document.getElementById('loading_text');

        // 检测是否为iOS设备
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (titleH1 && cover && loadingText) {
            // 如果是iOS设备，添加特殊类
            if (isIOS) {
                titleH1.classList.add('ios-device');
                document.body.classList.add('ios-device');
            }

            title_container.classList.add('resources-loaded');
            titleH1.classList.add('resources-loaded');
            cover.classList.add('resources-loaded');
            loadingText.classList.add('resources-loaded');
        }

        const mobileControls = document.getElementById('mobile_controls');
        if (mobileControls) {
            mobileControls.classList.add('resources-loaded');
        }

        // 显示返回主页按钮
        const homeBtns = document.querySelectorAll('#global-home-btn, #global-home-btn-mobile');
        homeBtns.forEach(btn => {
            if (btn) btn.classList.add('visible');
        });

        // 执行注册的回调
        setTimeout(() => {
            this._readyCallbacks.forEach(cb => {
                try { cb(); } catch (e) { console.error('Global loader callback error:', e); }
            });
        }, 800); // 等标题动画基本完成后再触发页面内容入场
    }
}

// 创建全局单例
window.globalLoader = new GlobalResourceLoader();
