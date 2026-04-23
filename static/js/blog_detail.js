// blog_detail.js - 博客详情页面脚本
document.addEventListener('DOMContentLoaded', function () {
    console.log('博客详情页面已加载');

    // ============================
    // 1. 目录导航 (TOC) 生成
    // ============================
    function generateTOC() {
        var markdownBody = document.querySelector('.markdown-body');
        var tocContent = document.getElementById('tocContent');
        var tocSection = document.getElementById('tocSection');

        if (!markdownBody || !tocContent || !tocSection) return;

        var headings = markdownBody.querySelectorAll('h1, h2, h3');

        if (headings.length === 0) {
            tocSection.classList.add('hidden');
            return;
        }

        tocContent.innerHTML = '';

        headings.forEach(function (heading, index) {
            // 确保每个标题有ID用于锚点定位
            if (!heading.id) {
                heading.id = 'heading-' + index;
            }

            var tocItem = document.createElement('a');
            tocItem.className = 'toc-item toc-' + heading.tagName.toLowerCase();
            tocItem.textContent = heading.textContent.replace(/^#\s*/, '').replace(/¶$/, '');
            tocItem.dataset.target = heading.id;
            tocItem.title = tocItem.textContent;

            tocItem.addEventListener('click', function (e) {
                e.preventDefault();
                var target = document.getElementById(this.dataset.target);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });

            tocContent.appendChild(tocItem);
        });

        // 滚动时高亮当前标题
        var tocItems = tocContent.querySelectorAll('.toc-item');

        function updateActiveHeading() {
            var current = null;

            headings.forEach(function (heading) {
                var rect = heading.getBoundingClientRect();
                if (rect.top <= 120) {
                    current = heading;
                }
            });

            tocItems.forEach(function (item) {
                item.classList.remove('active');
                if (current && item.dataset.target === current.id) {
                    item.classList.add('active');
                    // 确保当前激活的TOC项在可视区域内
                    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        }

        window.addEventListener('scroll', updateActiveHeading);
        updateActiveHeading();
    }

    // TOC 折叠/展开
    var tocToggle = document.getElementById('tocToggle');
    var tocSection = document.getElementById('tocSection');
    if (tocToggle && tocSection) {
        tocToggle.addEventListener('click', function () {
            tocSection.classList.toggle('collapsed');
        });
    }

    generateTOC();

    // ============================
    // 辅助函数：需要登录时跳转
    // ============================
    function requireLogin() {
        if (confirm('请先登录后再进行操作，是否前往登录？')) {
            window.location.href = BLOG_DATA.loginUrl;
        }
    }

    // ============================
    // 2. 点赞功能
    // ============================
    var likeBtn = document.getElementById('likeBtn');
    var likeIcon = document.getElementById('likeIcon');
    var likeCount = document.getElementById('likeCount');
    var hasLiked = BLOG_DATA.hasLiked;

    // 初始化点赞状态
    if (hasLiked && likeBtn) {
        likeBtn.classList.add('liked');
        likeIcon.textContent = '❤️';
    }

    if (likeBtn) {
        likeBtn.addEventListener('click', function () {
            if (!BLOG_DATA.isLoggedIn) {
                requireLogin();
                return;
            }

            var action = hasLiked ? 'remove' : 'add';

            fetch('/api/blog/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blog_id: BLOG_DATA.blogId,
                    action: action
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.need_login) {
                        requireLogin();
                        return;
                    }
                    if (data.success) {
                        hasLiked = !hasLiked;
                        likeCount.textContent = data.count;

                        if (hasLiked) {
                            likeBtn.classList.add('liked', 'animate');
                            likeIcon.textContent = '❤️';
                            setTimeout(function () {
                                likeBtn.classList.remove('animate');
                            }, 600);
                        } else {
                            likeBtn.classList.remove('liked');
                            likeIcon.textContent = '🤍';
                        }
                    }
                })
                .catch(function (err) {
                    console.error('点赞请求失败:', err);
                });
        });
    }

    // ============================
    // 3. 评论功能
    // ============================
    var commentBtn = document.getElementById('commentBtn');
    var commentModal = document.getElementById('commentModal');
    var modalClose = document.getElementById('modalClose');
    var modalCancel = document.getElementById('modalCancel');
    var modalSubmit = document.getElementById('modalSubmit');
    var commentInput = document.getElementById('commentInput');
    var charCount = document.getElementById('charCount');
    var commentBtnCount = document.getElementById('commentBtnCount');
    var commentsCount = document.getElementById('commentsCount');

    // 打开评论弹窗
    if (commentBtn) {
        commentBtn.addEventListener('click', function () {
            if (!BLOG_DATA.isLoggedIn) {
                requireLogin();
                return;
            }
            commentModal.classList.add('active');
            commentInput.focus();
        });
    }

    // 关闭评论弹窗
    function closeModal() {
        commentModal.classList.remove('active');
        commentInput.value = '';
        charCount.textContent = '0';
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalCancel) modalCancel.addEventListener('click', closeModal);

    // 点击遮罩关闭
    if (commentModal) {
        commentModal.addEventListener('click', function (e) {
            if (e.target === commentModal) {
                closeModal();
            }
        });
    }

    // ESC 关闭弹窗
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && commentModal && commentModal.classList.contains('active')) {
            closeModal();
        }
    });

    // 字数计数
    if (commentInput) {
        commentInput.addEventListener('input', function () {
            charCount.textContent = this.value.length;
        });
    }

    // 提交评论
    if (modalSubmit) {
        modalSubmit.addEventListener('click', function () {
            var content = commentInput.value.trim();
            if (!content) {
                alert('评论内容不能为空');
                return;
            }

            modalSubmit.disabled = true;
            modalSubmit.textContent = '提交中...';

            fetch('/api/blog/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blog_id: BLOG_DATA.blogId,
                    content: content
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.need_login) {
                        requireLogin();
                        return;
                    }
                    if (data.success) {
                        closeModal();
                        renderComments(data.comments);
                        // 更新评论计数
                        var count = data.comments.length;
                        commentBtnCount.textContent = count;
                        commentsCount.textContent = '(' + count + ')';
                    } else {
                        alert(data.error || '评论失败，请稍后重试');
                    }
                })
                .catch(function (err) {
                    console.error('评论请求失败:', err);
                    alert('评论失败，请稍后重试');
                })
                .finally(function () {
                    modalSubmit.disabled = false;
                    modalSubmit.textContent = '发表评论';
                });
        });
    }

    // ============================
    // 4. 渲染评论列表
    // ============================
    function renderComments(comments) {
        var commentsList = document.getElementById('commentsList');
        if (!commentsList) return;

        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<div class="no-comments">暂无评论，来发表第一条评论吧 ✨</div>';
            return;
        }

        commentsList.innerHTML = '';
        comments.forEach(function (comment) {
            var item = document.createElement('div');
            item.className = 'comment-item';

            var authorClass = comment.is_mine ? 'comment-author is-mine' : 'comment-author';

            item.innerHTML =
                '<div class="comment-item-header">' +
                '<span class="' + authorClass + '">' + escapeHtml(comment.nickname) + '</span>' +
                '<span class="comment-time">' + comment.time + '</span>' +
                '</div>' +
                '<div class="comment-body">' + escapeHtml(comment.content) + '</div>';

            commentsList.appendChild(item);
        });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    // ============================
    // 5. 加载初始数据
    // ============================
    function loadBlogData() {
        fetch('/api/blog/data/' + BLOG_DATA.blogId)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.success) {
                    // 更新点赞数
                    likeCount.textContent = data.likes_count;
                    hasLiked = data.has_liked;
                    if (hasLiked) {
                        likeBtn.classList.add('liked');
                        likeIcon.textContent = '❤️';
                    }

                    // 渲染评论
                    renderComments(data.comments);
                    var count = data.comments.length;
                    commentBtnCount.textContent = count;
                    commentsCount.textContent = '(' + count + ')';
                }
            })
            .catch(function (err) {
                console.error('加载博客数据失败:', err);
            });
    }

    loadBlogData();

    // ============================
    // 6. 回到顶部按钮
    // ============================
    var topBtn = document.getElementById('topBtn');
    if (topBtn) {
        topBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
