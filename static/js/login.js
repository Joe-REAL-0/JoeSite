function onBackgroundLoaded() {
    const cover = document.getElementById('cover');
    if (cover) {
        cover.classList.add('after-load');
    }
}

const img = new Image();
img.src = "static/images/background2.jpg";
img.onload = onBackgroundLoaded;

// 确保DOM加载完成后也可以触发
document.addEventListener('DOMContentLoaded', function() {
    // 如果图片已经加载完成，直接触发动画
    if (img.complete) {
        onBackgroundLoaded();
    }
});