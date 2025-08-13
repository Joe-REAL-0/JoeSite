// 检测设备类型
function isMobileDevice() {
    return (window.innerWidth <= 768);
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 添加设备类型标记
    document.documentElement.classList.add(isMobileDevice() ? 'mobile-device' : 'desktop-device');
    
    // 获取DOM元素
    const userAvatars = document.querySelectorAll('.UserAvatar');
    const messages = document.querySelectorAll('.Message');
    const likeButtons = document.querySelectorAll('.like-button');
    const commentButtons = document.querySelectorAll('.comment-button');
    const submitCommentButtons = document.querySelectorAll('.submit-comment');
    const deleteButtons = document.querySelectorAll('.delete-button');
    
    // 从Flask中获取消息数据
    const flaskData = document.getElementById('flask-data');
    let messagesData = [], usersData = [], isLoggedIn = false;
    
    try {
        messagesData = JSON.parse(flaskData.getAttribute('data-messages') || '[]');
        usersData = JSON.parse(flaskData.getAttribute('data-users') || '[]');
        isLoggedIn = JSON.parse(flaskData.getAttribute('data-is-logged-in') || 'false');
    } catch (error) {
        console.error('JSON解析错误:', error);
        // 设置默认值以防解析失败
        messagesData = [];
        usersData = [];
        isLoggedIn = false;
    }

    // 为每个用户头像添加点击事件
    userAvatars.forEach(avatar => {
        avatar.addEventListener('click', function() {
            const username = this.getAttribute('data-username');
            
            // 移除所有头像的激活状态
            userAvatars.forEach(a => a.classList.remove('active'));
            
            // 给当前选中的头像添加激活状态
            this.classList.add('active');
            
            // 隐藏所有留言
            messages.forEach(message => {
                message.style.display = 'none';
            });
            
            // 显示该用户的留言
            const userMessages = document.querySelectorAll(`.Message[data-username="${username}"]`);
            userMessages.forEach(message => {
                message.style.display = 'block';
            });
        });
    });
    
    // 模态框相关元素
    const loginModal = document.getElementById('login-modal');
    const deleteModal = document.getElementById('delete-modal');
    const cancelBtn = document.querySelector('.cancel-btn');
    const cancelDeleteBtn = document.querySelector('.cancel-delete-btn');
    const confirmDeleteBtn = document.querySelector('.confirm-delete-btn');
    
    // 存储待删除留言的信息
    let pendingDeleteMessageInfo = null;
    
    // 关闭登录模态框
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            loginModal.style.display = 'none';
        });
    }
    
    // 关闭删除模态框
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            deleteModal.style.display = 'none';
            pendingDeleteMessageInfo = null;
        });
    }
    
    // 确认删除
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (pendingDeleteMessageInfo) {
                // 发送删除请求
                fetch('/api/delete_message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message_nickname: pendingDeleteMessageInfo.nickname,
                        message_time: pendingDeleteMessageInfo.time
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        console.error('删除留言失败:', data.error);
                        alert('删除留言失败: ' + data.error);
                    }
                    window.location.reload();
                })
                .catch(error => {
                    console.error('删除留言请求错误:', error);
                    alert('删除留言请求错误，请稍后再试！');
                });
                
                // 关闭模态框
                deleteModal.style.display = 'none';
                pendingDeleteMessageInfo = null;
            }
        });
    }
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        }
        if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
            pendingDeleteMessageInfo = null;
        }
    });

    // 点赞功能
    likeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 检查登录状态
            if (!isLoggedIn) {
                loginModal.style.display = 'flex';
                return;
            }
            
            const messageNickname = this.getAttribute('data-nickname');
            const messageTime = this.getAttribute('data-time');
            const likeCount = this.querySelector('.like-count');
            const likeIcon = this.querySelector('.like-icon');
            const action = this.classList.contains('liked') ? 'remove' : 'add';
            
            // 发送AJAX请求
            fetch('/api/like_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message_nickname: messageNickname,
                    message_time: messageTime,
                    action: action
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 更新点赞数
                    likeCount.textContent = data.count;
                    
                    if (action === 'add') {
                        // 添加点赞动画和样式
                        this.classList.add('liked');
                        likeIcon.classList.add('animate');
                        
                        // 动画结束后移除动画类
                        setTimeout(() => {
                            likeIcon.classList.remove('animate');
                        }, 400);
                    } else {
                        // 移除点赞样式
                        this.classList.remove('liked');
                    }
                } else {
                    console.error('点赞操作失败:', data.error);
                }
            })
            .catch(error => {
                console.error('点赞请求错误:', error);
            });
        });
    });
    
    // 评论功能
    commentButtons.forEach(button => {
        button.addEventListener('click', function() {
            const messageId = this.getAttribute('data-message-id');
            const messageNickname = this.getAttribute('data-nickname');
            const messageTime = this.getAttribute('data-time');
            const commentsContainer = document.getElementById(`comments-${messageId}`);
            const commentForm = document.getElementById(`comment-form-${messageId}`);
            
            // 切换评论容器的显示状态
            if (commentsContainer.classList.contains('active')) {
                commentsContainer.classList.remove('active');
                commentsContainer.style.display = 'none';
                commentForm.style.display = 'none';
            } else {
                // 显示评论前先加载最新评论
                loadCommentsFromServer(messageNickname, messageTime, messageId);
                commentsContainer.classList.add('active');
                commentsContainer.style.display = 'block';
                commentForm.style.display = 'flex';
            }
        });
    });
    
    // 提交评论
    submitCommentButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 检查登录状态
            if (!isLoggedIn) {
                loginModal.style.display = 'flex';
                return;
            }
            
            const commentForm = this.closest('.comment-form');
            const messageId = commentForm.id.replace('comment-form-', '');
            const commentInput = commentForm.querySelector('.comment-input');
            const commentText = commentInput.value.trim();
            const messageNickname = this.getAttribute('data-nickname');
            const messageTime = this.getAttribute('data-time');
            
            if (commentText) {
                // 发送AJAX请求
                fetch('/api/add_comment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message_nickname: messageNickname,
                        message_time: messageTime,
                        content: commentText
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // 清空输入框
                        commentInput.value = '';
                        
                        // 更新评论区
                        updateCommentsDisplay(data.comments, messageId);
                        
                        // 更新评论计数
                        const commentCount = document.querySelector(`.comment-button[data-message-id="${messageId}"] .comment-count`);
                        commentCount.textContent = data.comments.length;
                    } else {
                        console.error('评论提交失败:', data.error);
                    }
                })
                .catch(error => {
                    console.error('评论请求错误:', error);
                });
            }
        });
    });
    
    // 从服务器加载评论
    function loadCommentsFromServer(messageNickname, messageTime, messageId) {
        fetch(`/api/get_message_data?message_nickname=${encodeURIComponent(messageNickname)}&message_time=${encodeURIComponent(messageTime)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 更新评论区
                updateCommentsDisplay(data.comments, messageId);
                
                // 更新评论计数
                const commentCount = document.querySelector(`.comment-button[data-message-id="${messageId}"] .comment-count`);
                commentCount.textContent = data.comments.length;
                
                // 更新点赞状态
                const likeButton = document.querySelector(`.like-button[data-message-id="${messageId}"]`);
                const likeCount = likeButton.querySelector('.like-count');
                likeCount.textContent = data.likes_count;
                
                if (data.has_liked) {
                    likeButton.classList.add('liked');
                } else {
                    likeButton.classList.remove('liked');
                }
            } else {
                console.error('获取评论数据失败:', data.error);
            }
        })
        .catch(error => {
            console.error('获取评论请求错误:', error);
        });
    }
    
    // 更新评论显示
    function updateCommentsDisplay(comments, messageId) {
        const commentsContainer = document.getElementById(`comments-${messageId}`);
        commentsContainer.innerHTML = ''; // 清空现有评论
        
        if (comments.length === 0) {
            const noCommentElement = document.createElement('div');
            noCommentElement.className = 'no-comment';
            noCommentElement.textContent = '暂无评论';
            commentsContainer.appendChild(noCommentElement);
            return;
        }
        
        // 创建一个映射以按昵称组织评论
        const commentsByNickname = new Map();
        
        comments.forEach(comment => {
            // 每个用户只显示一条评论（最新的）
            commentsByNickname.set(comment.nickname, comment);
        });
        
        // 显示所有唯一评论
        commentsByNickname.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            if (comment.is_mine) {
                commentElement.classList.add('my-comment');
            }
            
            commentElement.innerHTML = `
                <span class="comment-author">${comment.nickname}:</span>
                <span class="comment-text">${comment.content}</span>
                <span class="comment-time">${comment.time}</span>
            `;
            
            commentsContainer.appendChild(commentElement);
        });
    }
    
    // 初始化：为每个消息加载评论数据
    function initializeMessageData() {
        messages.forEach(message => {
            const messageId = message.querySelector('.like-button').getAttribute('data-message-id');
            const messageNickname = message.getAttribute('data-username');
            const messageTime = message.getAttribute('data-time');
            
            // 仅加载第一个可见消息的评论数据（其他在点击时加载）
            if (message.style.display !== 'none') {
                loadCommentsFromServer(messageNickname, messageTime, messageId);
            }
        });
    }
    
    // 删除留言功能
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const messageNickname = this.getAttribute('data-nickname');
            const messageTime = this.getAttribute('data-time');
            
            // 设置待删除的留言信息
            pendingDeleteMessageInfo = {
                nickname: messageNickname,
                time: messageTime
            };
            
            // 显示删除确认模态框
            deleteModal.style.display = 'flex';
        });
    });

    // 初始化消息数据
    initializeMessageData();
    
    // 调整布局函数
    function adjustLayout() {
        const newIsMobile = isMobileDevice();
        document.documentElement.classList.remove(newIsMobile ? 'desktop-device' : 'mobile-device');
        document.documentElement.classList.add(newIsMobile ? 'mobile-device' : 'desktop-device');
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', adjustLayout);
    
    // 初始化布局
    adjustLayout();
});
