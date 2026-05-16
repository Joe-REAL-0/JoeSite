/**
 * 主题切换逻辑
 * - 默认跟随系统 prefers-color-scheme
 * - 手动切换后保存到 localStorage，覆盖系统偏好
 * - 点击按钮在 light / dark / auto 三态之间循环
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'joe-site-theme';

    /**
     * 获取当前系统主题偏好
     */
    function getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    /**
     * 应用主题到 DOM
     * @param {'light'|'dark'|null} theme - null 表示跟随系统
     */
    function applyTheme(theme) {
        const root = document.documentElement;
        const body = document.body;

        if (theme) {
            // 手动指定主题
            root.setAttribute('data-theme', theme);
            if (body) {
                body.setAttribute('data-body-theme', theme);
            }
        } else {
            // 跟随系统 — 移除 data-theme，让 CSS media query 生效
            root.removeAttribute('data-theme');
            if (body) {
                body.removeAttribute('data-body-theme');
            }
        }
    }

    /**
     * 获取当前生效的主题（考虑手动设置和系统偏好）
     */
    function getEffectiveTheme() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }
        return getSystemTheme();
    }

    /**
     * 切换主题
     * 逻辑：当前是暗色 → 切换到亮色，当前是亮色 → 切换到暗色
     */
    function toggleTheme() {
        const current = getEffectiveTheme();
        const next = current === 'dark' ? 'light' : 'dark';

        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
    }

    /**
     * 初始化主题
     * 在 DOM ready 之前就执行，避免闪烁
     */
    function initTheme() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            applyTheme(saved);
        }
        // 如果没有保存的偏好，什么都不做，让 CSS media query 处理
    }

    // 立即执行初始化（script 在 head 中，先于 body 渲染）
    initTheme();

    // DOM 加载完成后绑定事件
    document.addEventListener('DOMContentLoaded', function () {
        // body 现在已存在，重新应用主题以确保 data-body-theme 被正确设置
        // （initTheme 在 head 中执行时 body 尚不存在，背景图属性会丢失）
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            applyTheme(saved);
        }

        const toggleBtns = document.querySelectorAll('#theme-toggle, #theme-toggle-mobile');
        toggleBtns.forEach(btn => {
            if (btn) btn.addEventListener('click', toggleTheme);
        });

        // 监听系统主题变化（当用户没有手动设置时自动响应）
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) {
                    // 没有手动设置，跟随系统变化（CSS 自动处理，这里不需要额外操作）
                    // 但需要确保 body 的 data-body-theme 也跟随
                    applyTheme(null);
                }
            });
        }
    });

    // 暴露到全局，方便其他脚本调用
    window.JoeTheme = {
        toggle: toggleTheme,
        getEffective: getEffectiveTheme,
        apply: applyTheme
    };
})();
