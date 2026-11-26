import { onDomReady } from './dom-ready.js';

/* ===========================================================
   移动端悬浮竖栏 (#mobile_controls)
   1. 滚动感知：向下阅读时整栏滑出屏幕，向上回看 / 到达首尾时复现，
      避免固定按钮压住正文。
   2. 页面级操作按钮（如博客详情的点赞 / 评论 / 回到顶部）并入同一条
      竖栏，仅移动端生效，桌面端还原到原位置。
   =========================================================== */
onDomReady(() => {
    var MOBILE_QUERY = '(max-width: 768px)';
    var HIDE_AFTER = 8;          // 小于该位移视为抖动，不切换状态
    var TOP_SAFE_ZONE = 120;     // 顶部区域始终可见
    var BOTTOM_SAFE_ZONE = 48;   // 触底时始终可见，保证"回到顶部"可达
    var EDGE_REVEAL_ZONE = 56;   // 右边缘点击唤出区域
    var EDGE_RESERVE = 24;       // 页面末尾在竖栏高度之外再留的呼吸空间

    var rail = document.getElementById('mobile_controls');
    if (!rail) return;

    var mq = window.matchMedia(MOBILE_QUERY);

    /* ---------- 1. 页面级操作并入竖栏 ---------- */
    var groups = Array.prototype.slice.call(document.querySelectorAll('[data-mobile-rail]'));
    groups.forEach(function (group) {
        var anchor = document.createComment('mobile-rail-anchor');
        group.parentNode.insertBefore(anchor, group);
        group._railAnchor = anchor;
        group._railHost = group.closest('.right-sidebar');
    });

    function syncLayout() {
        var mobile = mq.matches;
        groups.forEach(function (group) {
            if (mobile) {
                // 追加到末位：column-reverse 下排在竖栏顶部
                rail.appendChild(group);
                group.classList.add('in-rail');
                if (group._railHost) group._railHost.classList.add('rail-detached');
            } else {
                group._railAnchor.parentNode.insertBefore(group, group._railAnchor);
                group.classList.remove('in-rail');
                if (group._railHost) group._railHost.classList.remove('rail-detached');
            }
        });
        updateReserve();
        if (!mobile) setHidden(false);
    }

    /* 竖栏占据的视口高度实测后写入末尾占位块，
       滚到页面底部时最后一段内容不会被按钮压住。
       占位量保持恒定，避免滚动时页面高度抖动。 */
    var spacer = document.createElement('div');
    spacer.className = 'mobile-rail-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spacer);

    function updateReserve() {
        spacer.style.height = '0px';

        // 横向排布的竖栏（如云盘页）不占正文阅读区域的底部
        var vertical = getComputedStyle(rail).flexDirection.indexOf('row') === -1;
        // 满屏且本就不滚动的页面（首页、登录页）不能被占位块撑出滚动条
        var scrolls = document.documentElement.scrollHeight > window.innerHeight + 1;

        if (mq.matches && vertical && scrolls) {
            // 竖栏顶部到视口底部的距离即它实际压住的画面高度
            var reserve = Math.round(window.innerHeight - rail.getBoundingClientRect().top) + EDGE_RESERVE;
            spacer.style.height = reserve + 'px';
        }
    }

    /* ---------- 2. 滚动显隐 ---------- */
    var lastY = Math.max(0, window.scrollY || 0);
    var hidden = false;
    var frame = 0;

    function setHidden(next) {
        if (next === hidden) return;
        hidden = next;
        rail.classList.toggle('is-hidden', next);
        // 滑出后被遮住的按钮不应再接收焦点或朗读
        if ('inert' in rail) rail.inert = next;
    }

    function evaluate() {
        frame = 0;
        var y = Math.max(0, window.scrollY || 0);
        var delta = y - lastY;
        lastY = y;
        if (!mq.matches) return;

        var maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

        if (y <= TOP_SAFE_ZONE || y >= maxY - BOTTOM_SAFE_ZONE) {
            setHidden(false);
        } else if (delta > HIDE_AFTER) {
            setHidden(true);
        } else if (delta < -HIDE_AFTER) {
            setHidden(false);
        }
    }

    window.addEventListener('scroll', function () {
        if (!frame) frame = window.requestAnimationFrame(evaluate);
    }, { passive: true });

    // 竖栏隐藏时，点击右边缘的非交互区域可将其唤出
    document.addEventListener('click', function (event) {
        if (!hidden || !mq.matches) return;
        if (event.clientX < window.innerWidth - EDGE_REVEAL_ZONE) return;
        var target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('a, button, input, textarea, select, label, [role="button"]')) return;
        setHidden(false);
    });

    // 按钮数量 / 字体变化都会改变竖栏高度，预留量随之更新
    if (window.ResizeObserver) {
        new ResizeObserver(updateReserve).observe(rail);
    }
    window.addEventListener('resize', updateReserve, { passive: true });

    if (mq.addEventListener) {
        mq.addEventListener('change', syncLayout);
    } else if (mq.addListener) {
        mq.addListener(syncLayout);
    }

    syncLayout();
    if (window.scrollY > TOP_SAFE_ZONE) setHidden(true);
});
