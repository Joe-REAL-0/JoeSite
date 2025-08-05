// 检测设备类型
function isMobileDevice() {
    return (window.innerWidth <= 768);
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 添加设备类型标记
    document.documentElement.classList.add(isMobileDevice() ? 'mobile-device' : 'desktop-device');
    
    let currentPage = 1; // 初始页设置为1，会被HTML中的变量覆盖
    let loading = false;
    let hasMore = false; // 默认值，会被HTML中的变量覆盖
    const container = document.getElementById('friend_link_container');
    const loadingIndicator = document.getElementById('loading');
    const friendLinkPanel = document.getElementById('friend_link_panel');
    const isMobile = window.innerWidth <= 768;
    
    // 监听滚动事件
    const scrollElement = isMobile ? window : friendLinkPanel;
    scrollElement.addEventListener('scroll', handleScroll);
    
    // 处理滚动事件
    function handleScroll(e) {
        let scrollTop, scrollHeight, clientHeight;
        
        if (isMobile) {
            scrollTop = window.scrollY;
            scrollHeight = document.body.scrollHeight;
            clientHeight = window.innerHeight;
        } else {
            scrollTop = friendLinkPanel.scrollTop;
            scrollHeight = friendLinkPanel.scrollHeight;
            clientHeight = friendLinkPanel.clientHeight;
        }
        
        // 当滚动到底部时加载更多
        if (scrollTop + clientHeight >= scrollHeight - 100 && !loading && hasMore) {
            loadMore();
        }
    }
    
    // 适配触摸屏滑动
    if (isMobile) {
        let touchStartY = 0;
        document.addEventListener('touchstart', function(e) {
            touchStartY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchmove', function(e) {
            const touchY = e.touches[0].clientY;
            const touchDiff = touchStartY - touchY;
            
            // 向上滑动且接近底部时
            if (touchDiff > 30) {
                const scrollTop = window.scrollY;
                const scrollHeight = document.body.scrollHeight;
                const clientHeight = window.innerHeight;
                
                if (scrollTop + clientHeight >= scrollHeight - 150 && !loading && hasMore) {
                    loadMore();
                }
            }
        });
    }
    
    // 调整页面布局
    function adjustLayout() {
        const newIsMobile = window.innerWidth <= 768;
        
        // 如果设备类型发生变化，重新绑定滚动事件
        if (newIsMobile !== isMobile) {
            scrollElement.removeEventListener('scroll', handleScroll);
            const newScrollElement = newIsMobile ? window : friendLinkPanel;
            newScrollElement.addEventListener('scroll', handleScroll);
            
            // 更新设备类型标记
            document.documentElement.classList.remove(newIsMobile ? 'desktop-device' : 'mobile-device');
            document.documentElement.classList.add(newIsMobile ? 'mobile-device' : 'desktop-device');
        }
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', adjustLayout);
    
    // 加载更多友情链接
    function loadMore() {
        if (loading) return;
        
        loading = true;
        currentPage++;
        
        if (loadingIndicator) {
            loadingIndicator.classList.remove('hidden');
        }
        
        fetch(`/api/friend_links?page=${currentPage}`)
            .then(response => response.json())
            .then(data => {
                // 添加新的友情链接到容器中
                data.friend_links.forEach(link => {
                    const linkElement = document.createElement('div');
                    linkElement.className = 'FriendLink';
                    
                    // 使用动画效果使新元素淡入
                    linkElement.style.opacity = '0';
                    linkElement.style.transform = 'translateY(20px)';
                    linkElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    
                    linkElement.innerHTML = `
                        <img src="/static/images/avatars/${link.avatar}" alt="${link.nickname}的头像">
                        <div class="info">
                            <p class="nickname">${link.nickname}</p>
                            <p class="link">
                                <a href="${link.url.startsWith('http') ? link.url : 'https://' + link.url}" target="_blank">${link.url}</a>
                            </p>
                        </div>
                    `;
                    container.appendChild(linkElement);
                    
                    // 触发重排后应用动画
                    setTimeout(() => {
                        linkElement.style.opacity = '1';
                        linkElement.style.transform = 'translateY(0)';
                    }, 10);
                });
                
                // 更新是否还有更多数据
                hasMore = data.has_more;
                
                // 如果没有更多数据，隐藏加载指示器
                if (!hasMore && loadingIndicator) {
                    loadingIndicator.classList.add('hidden');
                }
            })
            .catch(error => {
                console.error('加载友情链接时出错:', error);
            })
            .finally(() => {
                loading = false;
                if (loadingIndicator) {
                    loadingIndicator.classList.add('hidden');
                }
            });
    }
    
    // 初始化布局
    adjustLayout();
});

// 导出设置页面变量的函数供HTML中使用
function setFriendLinkVars(page, hasMoreLinks) {
    window.currentPage = page;
    window.hasMore = hasMoreLinks;
}
