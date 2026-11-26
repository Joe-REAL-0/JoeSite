import { onDomReady } from './dom-ready.js';

/**
 * 背景光点生成器
 * 位置、大小、透明度、速度、延迟全部随机；数值来自 global.css 的 --particle-* 变量。
 * 粒子只在画面右侧生成，并统一漂向右上角的渐隐区，因此循环时不会看到瞬移。
 */
onDomReady(() => {
    const LAYER_SELECTOR = '.portrait-particles';
    // 起点占视口的横向比例区间，控制"集中在右侧"的浓度。
    const START_X_MIN = 0.45;
    const START_X_MAX = 0.95;
    const START_Y_MIN = 0.05;
    const START_Y_MAX = 1.05;
    // 终点落在右上角外侧，配合遮罩渐隐。
    const END_X_CENTER = 0.98;
    const END_X_SPREAD = 0.12;
    const END_Y_CENTER = -0.04;
    const END_Y_SPREAD = 0.16;
    // 终点至少比起点高一个最小行程，保证方向始终向右上。
    const MIN_LIFT = 0.12;

    const num = (styles, name, fallback) => {
        const value = parseFloat(styles.getPropertyValue(name));
        return Number.isFinite(value) ? value : fallback;
    };
    const pick = (min, max) => min + Math.random() * (max - min);

    const build = (layer) => {
        const root = getComputedStyle(document.documentElement);
        const count = Math.round(num(root, '--particle-count', 28));
        const sizeMin = num(root, '--particle-size-min', 2);
        const sizeMax = num(root, '--particle-size-max', 4);
        const speedMin = num(root, '--particle-speed-min', 40);
        const speedMax = num(root, '--particle-speed-max', 110);
        const intro = num(root, '--particle-intro', 0.25);
        const spread = num(root, '--particle-fade-spread', 0.7);

        const { width, height } = layer.getBoundingClientRect();
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < count; i += 1) {
            const startX = width * pick(START_X_MIN, START_X_MAX);
            const startY = height * pick(START_Y_MIN, START_Y_MAX);
            const endX = Math.max(startX + width * 0.05, width * (END_X_CENTER - END_X_SPREAD + Math.random() * END_X_SPREAD * 2));
            const endY = Math.min(startY - height * MIN_LIFT, height * (END_Y_CENTER + Math.random() * END_Y_SPREAD));

            const driftX = endX - startX;
            const driftY = endY - startY;
            const speed = pick(speedMin, speedMax);
            const duration = Math.hypot(driftX, driftY) / speed;
            const size = pick(sizeMin, sizeMax);

            const dot = document.createElement('span');
            dot.style.setProperty('--particle-x', `${startX.toFixed(2)}px`);
            dot.style.setProperty('--particle-y', `${startY.toFixed(2)}px`);
            dot.style.setProperty('--particle-size', `${size.toFixed(2)}px`);
            dot.style.setProperty('--particle-opacity', pick(0.35, 0.95).toFixed(2));
            dot.style.setProperty('--particle-duration', `${duration.toFixed(2)}s`);
            dot.style.setProperty('--particle-delay', `${(-Math.random() * duration).toFixed(2)}s`);
            dot.style.setProperty('--particle-drift-x', `${driftX.toFixed(2)}px`);
            dot.style.setProperty('--particle-drift-y', `${driftY.toFixed(2)}px`);
            // 接在立绘显现之后错峰淡入。
            dot.style.setProperty('--particle-fade-delay', `${(intro + Math.random() * spread).toFixed(2)}s`);

            fragment.appendChild(dot);
        }

        layer.replaceChildren(fragment);
    };

    const layer = document.querySelector(LAYER_SELECTOR);
    if (!layer) return;

    build(layer);
    let frame = 0;
    window.addEventListener('resize', () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => build(layer));
    }, { passive: true });
});
