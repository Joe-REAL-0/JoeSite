import { onDomReady } from './dom-ready.js';

// CSS owns the font URLs, including their build hashes. Load the declared families.
const fontFamilies = ['GunShi', 'YuanTi', 'LengKu', 'valorax', 'Technonomicon'];

function collectResources() {
    const resources = document.fonts?.load
        ? fontFamilies.map(family => document.fonts.load(`16px "${family}"`))
        : [];

    if (document.body.classList.contains('home-page')) {
        // This pseudo-element paints one responsive image. Its computed URL uses
        // the same breakpoint and optimized asset as the visible background.
        const background = getComputedStyle(document.body, '::before').backgroundImage;
        const match = /^url\(["']?(.*?)["']?\)$/.exec(background);
        if (match) {
            resources.push(new Promise(resolve => {
                const image = new Image();
                image.onload = image.onerror = resolve;
                image.src = match[1];
            }));
        }
    }
    return resources;
}

function revealPage(cover) {
    const title = document.getElementById('title_container');
    const heading = title?.querySelector('h1');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
        heading?.classList.add('ios-device');
        document.body.classList.add('ios-device');
    }

    title?.classList.add('resources-loaded');
    heading?.classList.add('resources-loaded');
    document.getElementById('loading_text')?.classList.add('resources-loaded');
    document.getElementById('mobile_controls')?.classList.add('resources-loaded');
    document.querySelectorAll('#global-home-btn, #global-home-btn-mobile').forEach(button => {
        button.classList.add('visible');
    });

    if (cover) {
        const removeCover = event => {
            if (event && event.animationName !== 'coverSplitBottom') return;
            clearTimeout(fallback);
            cover.removeEventListener('animationend', removeCover);
            cover.remove();
            document.body.classList.add('character-revealed');
        };
        // CSS animations can be disabled or interrupted.
        const fallback = setTimeout(removeCover, 1000);
        cover.addEventListener('animationend', removeCover);
        cover.classList.add('resources-loaded');
    } else {
        document.body.classList.add('character-revealed');
    }

    if (document.body.classList.contains('home-page')) {
        setTimeout(() => document.body.classList.add('home-ready'), 800);
    }
}

onDomReady(() => {
    const cover = document.getElementById('cover');
    if (!cover) {
        revealPage(null);
        return;
    }

    const percentage = document.getElementById('cover-percentage');
    const resources = collectResources();
    let completed = 0;
    const markComplete = () => { completed++; };
    for (const resource of resources) resource.then(markComplete, markComplete);

    // A stalled resource must never hold the cover open indefinitely.
    const deadline = performance.now() + 10000;
    let displayed = 0;
    let previousTime;
    function frame(time) {
        const target = time >= deadline || !resources.length ? 1 : completed / resources.length;
        if (previousTime === undefined) previousTime = time;
        displayed = Math.min(target, displayed + (time - previousTime) / 100);
        previousTime = time;
        const percent = Math.floor(displayed * 100);
        cover.style.setProperty('--loading-progress', displayed);
        cover.setAttribute('aria-valuenow', percent);
        if (percentage) percentage.textContent = `${percent}%`;
        if (displayed < 1) {
            requestAnimationFrame(frame);
        } else {
            // Paint 100% for a frame before splitting the cover.
            requestAnimationFrame(() => {
                cover.classList.add('progress-complete');
                setTimeout(() => revealPage(cover), 120);
            });
        }
    }
    requestAnimationFrame(frame);
});
