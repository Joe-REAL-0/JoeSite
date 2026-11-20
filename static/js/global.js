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
        this.animateProgress();
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

    animateProgress() {
        const cover = document.getElementById('cover');
        const percentage = document.getElementById('cover-percentage');
        this._targetProgress = 0;
        let displayed = 0;
        let previousTime;
        // 从首个可绘制帧计时，缓存命中或空列表也至少走满 100ms。
        const frame = (time) => {
            if (previousTime === undefined) previousTime = time;
            displayed = Math.min(this._targetProgress, displayed + (time - previousTime) / 100);
            previousTime = time;
            const percent = Math.floor(displayed * 100);
            if (cover) {
                cover.style.setProperty('--loading-progress', displayed);
                cover.setAttribute('aria-valuenow', percent);
            }
            if (percentage) percentage.textContent = `${percent}%`;
            if (displayed < 1) {
                requestAnimationFrame(frame);
            } else {
                // 留一帧绘制完整线条和 100%，然后闪烁，再分开遮罩。
                requestAnimationFrame(() => {
                    if (cover) cover.classList.add('progress-complete');
                    setTimeout(() => this.triggerAnimation(), 120);
                });
            }
        };
        requestAnimationFrame(frame);
    }

    async loadAllResources() {
        let completedCount = 0;
        await Promise.allSettled(this.requiredResources.map(async (url) => {
            try {
                const loadedUrl = await this.checkResource(url);
                this.loadedResources.add(loadedUrl);
            } finally {
                completedCount++;
                // 失败、超时沿用原有放行策略，也计入已处理资源。
                this._targetProgress = completedCount / this.totalResources;
            }
        }));
        this._targetProgress = 1;
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
            // 按实际动画结束清理，避免截断切口离场效果。
            const removeCover = (event) => {
                if (event && event.animationName !== 'coverSplitBottom') return;
                cover.removeEventListener('animationend', removeCover);
                cover.remove();
                document.body.classList.add('character-revealed');
            };
            cover.addEventListener('animationend', removeCover);
            cover.classList.add('resources-loaded');
            // 动画被外部样式禁用时仍能清理遮罩。
            setTimeout(() => removeCover(), 1000);
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
