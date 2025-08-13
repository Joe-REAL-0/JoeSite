document.addEventListener('DOMContentLoaded', function() {
    // 移动端检测和优化
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 添加移动端类
    if (isMobile) {
        document.body.classList.add('mobile-device');
    }
    
    // 移动端视口优化
    if (isMobile && !document.querySelector('meta[name="viewport"]')) {
        const viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(viewportMeta);
    }
    
    // 设置侧边栏切换功能
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const contentContainer = document.getElementById('content-container');
    
    if (sidebarToggle && sidebar) {
        // 点击切换按钮
        sidebarToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });
        
        // 点击内容区域时隐藏侧边栏（移动端）
        if (contentContainer && isMobile) {
            contentContainer.addEventListener('click', function() {
                if (sidebar.classList.contains('expanded')) {
                    closeSidebar();
                }
            });
        }
        
        // 添加键盘支持
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('expanded')) {
                closeSidebar();
            }
        });
        
        // 触摸滑动支持（移动端）
        if (isTouch && isMobile) {
            let startX = 0;
            let currentX = 0;
            let isDragging = false;
            
            sidebar.addEventListener('touchstart', function(e) {
                startX = e.touches[0].clientX;
                isDragging = true;
            });
            
            sidebar.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                currentX = e.touches[0].clientX;
                const deltaX = currentX - startX;
                
                // 向左滑动关闭侧边栏
                if (deltaX < -50) {
                    closeSidebar();
                    isDragging = false;
                }
            });
            
            sidebar.addEventListener('touchend', function() {
                isDragging = false;
            });
        }
    }
    
    function toggleSidebar() {
        if (sidebar.classList.contains('expanded')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }
    
    function openSidebar() {
        sidebar.classList.add('expanded');
        sidebarToggle.textContent = '✕';
        sidebarToggle.setAttribute('aria-expanded', 'true');
    }
    
    function closeSidebar() {
        sidebar.classList.remove('expanded');
        sidebarToggle.textContent = '☰';
        sidebarToggle.setAttribute('aria-expanded', 'false');
    }
    
    
    // 初始化显示第一个部分
    const sectionItems = document.querySelectorAll('.SectionTitle');
    const sections = document.querySelectorAll('.section-content');
    
    if (sectionItems.length > 0) {
        const firstSection = sectionItems[0].getAttribute('data-section');
        showSection(firstSection);
        sectionItems[0].classList.add('active');
    }
    
    // 添加点击事件监听器到所有部分标题
    sectionItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 移除所有部分标题的活动类
            sectionItems.forEach(el => el.classList.remove('active'));
            
            // 添加活动类到被点击的部分标题
            this.classList.add('active');
            
            // 获取部分ID并显示
            const section = this.getAttribute('data-section');
            showSection(section);
            
            // 在移动设备上，选择后折叠侧边栏
            if (isMobile && sidebar && sidebar.classList.contains('expanded')) {
                closeSidebar();
            }
            
            // 移动端滚动到内容顶部
            if (isMobile && contentContainer) {
                contentContainer.scrollTop = 0;
            }
        });
        
        // 添加触摸反馈，修复移动端按钮保持active状态的问题
        if (isTouch) {
            item.addEventListener('touchstart', function(e) {
                // 移除所有其他按钮的触摸反馈类
                document.querySelectorAll('.SectionTitle').forEach(el => {
                    el.classList.remove('touch-feedback');
                });
                this.classList.add('touch-feedback');
            }, { passive: true });
            
            item.addEventListener('touchend', function(e) {
                const self = this;
                setTimeout(() => {
                    self.classList.remove('touch-feedback');
                }, 150);
            }, { passive: true });
            
            // 处理touchcancel事件，确保反馈类被移除
            item.addEventListener('touchcancel', function(e) {
                this.classList.remove('touch-feedback');
            }, { passive: true });
        }
    });
    
    // 显示特定部分
    function showSection(sectionId) {
        // 隐藏所有部分
        sections.forEach(section => {
            section.classList.remove('active');
        });
        
        // 显示选中的部分
        const activeSection = document.getElementById(`${sectionId}-section`);
        if (activeSection) {
            activeSection.classList.add('active');
            
            // 移动端聚焦优化
            if (isMobile) {
                // 滚动到内容顶部
                if (contentContainer) {
                    contentContainer.scrollTop = 0;
                }
                
                // 延迟聚焦到第一个输入框（避免虚拟键盘问题）
                setTimeout(() => {
                    const firstInput = activeSection.querySelector('input:not([disabled]):not([type="file"])');
                    if (firstInput && !firstInput.readOnly) {
                        firstInput.focus();
                    }
                }, 300);
            }
        }
    }
    
    // 头像上传功能
    const avatarUpload = document.getElementById('avatar_upload');
    const userAvatar = document.getElementById('user_avatar');
    const profileAvatar = document.getElementById('profile_avatar'); // 个人信息中的头像
    const avatarSubmit = document.getElementById('avatar_submit');
    const fileSelected = document.getElementById('file-selected');
    const avatarUploadLabel = document.getElementById('avatar_upload_label');

    // 初始时隐藏上传按钮
    if (avatarSubmit) {
        avatarSubmit.style.display = 'none';
    }

    // 移动端优化的文件选择处理
    if (avatarUploadLabel) {
        // 为移动端优化点击体验
        avatarUploadLabel.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 移动端特殊处理
            if (isMobile) {
                // 添加触觉反馈
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                // 更新按钮状态
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
                
                // 显示提示信息
                if (fileSelected) {
                    fileSelected.textContent = '正在打开相册...';
                }
            }
            
            // 触发文件选择
            if (avatarUpload) {
                avatarUpload.click();
            }
        });
        
        // 移动端触摸事件优化
        if (isMobile) {
            avatarUploadLabel.addEventListener('touchstart', function(e) {
                this.style.backgroundColor = 'rgba(104, 217, 255, 0.9)';
            }, {passive: true});
            
            avatarUploadLabel.addEventListener('touchend', function(e) {
                setTimeout(() => {
                    this.style.backgroundColor = '';
                }, 200);
            }, {passive: true});
        }
    }

    // 当选择文件后，显示预览
    if (avatarUpload) {
        // 为移动端优化accept属性
        if (isMobile) {
            // 移动端优先支持的图片格式
            avatarUpload.setAttribute('accept', 'image/jpeg,image/jpg,image/png,image/gif,image/webp');
            // 建议从相机拍摄或相册选择
            avatarUpload.setAttribute('capture', 'environment');
        }
        
        avatarUpload.addEventListener('change', function() {
            // 重置文件选择提示
            if (fileSelected && fileSelected.textContent === '正在打开相册...') {
                fileSelected.textContent = '未选择文件';
            }
            
            if (this.files && this.files[0]) {
                const file = this.files[0];
                
                // 检查文件类型
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                    showAlert('请选择有效的图片文件（支持JPG、PNG、GIF、WebP格式）');
                    this.value = '';
                    return;
                }
                
                // 检查文件大小，限制在5MB以内
                if (file.size > 5 * 1024 * 1024) {
                    showAlert('图片大小不能超过5MB，请选择较小的图片');
                    this.value = '';
                    return;
                }
                
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    // 更新头像预览
                    userAvatar.src = e.target.result;
                    // 显示上传按钮
                    avatarSubmit.style.display = 'block';
                    // 显示选中的文件名
                    if (fileSelected) {
                        const fileName = file.name.length > 20 ? 
                            file.name.substring(0, 17) + '...' : file.name;
                        fileSelected.textContent = `已选择: ${fileName}`;
                        fileSelected.style.color = '#4CAF50';
                    }
                    // 改变选择按钮文字
                    if (avatarUploadLabel) {
                        avatarUploadLabel.textContent = '更换其他图片';
                    }
                    
                    // 移动端成功反馈
                    if (isMobile && navigator.vibrate) {
                        navigator.vibrate([100, 50, 100]);
                    }
                }
                
                reader.onerror = function() {
                    showAlert('读取文件失败，请重试');
                    avatarUpload.value = '';
                    if (fileSelected) {
                        fileSelected.textContent = '未选择文件';
                        fileSelected.style.color = '';
                    }
                }
                
                reader.readAsDataURL(file);
            } else {
                // 用户取消选择文件
                if (fileSelected) {
                    fileSelected.textContent = '未选择文件';
                    fileSelected.style.color = '';
                }
                if (avatarUploadLabel) {
                    avatarUploadLabel.textContent = '选择新头像';
                }
                if (avatarSubmit) {
                    avatarSubmit.style.display = 'none';
                }
            }
        });
        
        // 处理文件拖拽（桌面端）
        if (!isMobile && avatarUploadLabel) {
            avatarUploadLabel.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.style.backgroundColor = 'rgba(104, 217, 255, 0.5)';
            });
            
            avatarUploadLabel.addEventListener('dragleave', function(e) {
                this.style.backgroundColor = '';
            });
            
            avatarUploadLabel.addEventListener('drop', function(e) {
                e.preventDefault();
                this.style.backgroundColor = '';
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    avatarUpload.files = files;
                    // 手动触发change事件
                    const event = new Event('change', { bubbles: true });
                    avatarUpload.dispatchEvent(event);
                }
            });
        }
    }

    // 移动端友好的提示函数
    function showAlert(message) {
        if (isMobile) {
            // 移动端使用更友好的提示方式
            const alertDiv = document.createElement('div');
            alertDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 10000;
                text-align: center;
                max-width: 80%;
                font-size: 16px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            alertDiv.textContent = message;
            document.body.appendChild(alertDiv);
            
            setTimeout(() => {
                alertDiv.remove();
            }, 3000);
        } else {
            alert(message);
        }
    }
    
    // 友链表单处理
    const friendLinkInput = document.getElementById('friend_link_input');
    const profileFriendLink = document.getElementById('profile-friend-link');
    
    if (friendLinkInput && profileFriendLink) {
        // 确保友链输入框初始化了正确的值
        // 现在从current_user中获取，所以这里可以保持不变
        friendLinkInput.value = profileFriendLink.textContent.trim();
    }
    
    // 昵称表单处理
    const nicknameForm = document.getElementById('nickname_form');
    const newNicknameInput = document.getElementById('new_nickname');
    const nicknameStatus = document.getElementById('nickname-status');
    
    if (nicknameForm && newNicknameInput && nicknameStatus) {
        // 设置一个防抖定时器以减少请求频率
        let nicknameCheckTimeout;
        
        // 在输入框内容变化时检查昵称是否可用
        newNicknameInput.addEventListener('input', function() {
            clearTimeout(nicknameCheckTimeout);
            const nickname = this.value.trim();
            
            // 清空状态消息
            nicknameStatus.textContent = '';
            
            // 如果昵称为空，不执行检查
            if (!nickname) {
                return;
            }
            
            // 设置一个延迟，避免频繁发送请求
            nicknameCheckTimeout = setTimeout(function() {
                // 显示检查中消息
                nicknameStatus.textContent = '检查昵称中...';
                nicknameStatus.style.color = 'blue';
                
                // 发送检查请求
                fetch('/check_nickname', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ nickname: nickname }),
                })
                .then(response => response.json())
                .then(data => {
                    nicknameStatus.textContent = data.message;
                    nicknameStatus.style.color = data.available ? 'green' : 'red';
                    
                    // 存储昵称可用状态，用于表单提交验证
                    newNicknameInput.dataset.available = data.available;
                })
                .catch(error => {
                    console.error('检查昵称出错:', error);
                    nicknameStatus.textContent = '检查昵称时出错，请稍后重试';
                    nicknameStatus.style.color = 'red';
                    newNicknameInput.dataset.available = 'false';
                });
            }, 500); // 500毫秒的延迟
        });
        
        // 表单提交验证
        nicknameForm.addEventListener('submit', function(e) {
            const newNickname = newNicknameInput.value.trim();
            
            // 检查昵称是否为空
            if (!newNickname) {
                e.preventDefault();
                nicknameStatus.textContent = '昵称不能为空';
                nicknameStatus.style.color = 'red';
                return;
            }
            
            // 检查昵称是否可用
            if (newNicknameInput.dataset.available === 'false') {
                e.preventDefault();
                // 如果已经有错误消息就不再显示新消息
                if (!nicknameStatus.textContent || nicknameStatus.textContent === '检查昵称中...') {
                    nicknameStatus.textContent = '该昵称已被其他用户使用，请选择其他昵称';
                    nicknameStatus.style.color = 'red';
                }
            }
        });
    }
    
    // 邮箱表单处理
    const emailForm = document.getElementById('email_form');
    const sendCodeBtn = document.getElementById('send_code_btn');
    
    // 发送验证码功能
        if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', function() {
            const newEmail = document.getElementById('new_email').value.trim();
            const currentEmail = document.getElementById('current_email').value.trim();
            
            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!newEmail || !emailRegex.test(newEmail)) {
                document.getElementById('email-status').textContent = '请输入有效的邮箱地址';
                document.getElementById('email-status').style.color = 'red';
                return;
            }
            
            // 检查是否与当前邮箱相同
            if (newEmail === currentEmail) {
                document.getElementById('email-status').textContent = '新邮箱不能与当前邮箱相同';
                document.getElementById('email-status').style.color = 'red';
                return;
            }
            
            // 禁用按钮，开始倒计时
            this.disabled = true;
            let countdown = 60;
            this.textContent = `${countdown}秒后重试`;
            
            // 设置倒计时
            const timer = setInterval(() => {
                countdown--;
                this.textContent = `${countdown}秒后重试`;
                if (countdown <= 0) {
                    clearInterval(timer);
                    this.textContent = '获取验证码';
                    this.disabled = false;
                }
            }, 1000);
            
            // 发送验证码请求
            fetch('/email_verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: newEmail, action: 'update_email' })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.message || '验证码发送失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                document.getElementById('email-status').textContent = data.message;
                document.getElementById('email-status').style.color = 'white';
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('email-status').textContent = error.message || '验证码发送失败，请稍后重试';
                document.getElementById('email-status').style.color = 'red';
                
                // 如果发生错误，重置倒计时
                clearInterval(timer);
                this.textContent = '获取验证码';
                this.disabled = false;
            });
        });
    }    if (emailForm) {
        emailForm.addEventListener('submit', function(e) {
            const newEmail = document.getElementById('new_email').value.trim();
            const currentEmail = document.getElementById('current_email').value.trim();
            const password = document.getElementById('password_for_email').value;
            const verificationCode = document.getElementById('verification_code').value.trim();
            
            if (!newEmail) {
                e.preventDefault();
                document.getElementById('email-status').textContent = '邮箱不能为空';
                document.getElementById('email-status').style.color = 'red';
                return;
            }
            
            if (!password) {
                e.preventDefault();
                document.getElementById('email-status').textContent = '请输入密码';
                document.getElementById('email-status').style.color = 'red';
                return;
            }
            
            if (!verificationCode) {
                e.preventDefault();
                document.getElementById('email-status').textContent = '请输入验证码';
                document.getElementById('email-status').style.color = 'red';
                return;
            }
            
            // 检查是否与当前邮箱相同
            if (newEmail === currentEmail) {
                e.preventDefault();
                document.getElementById('email-status').textContent = '新邮箱不能与当前邮箱相同';
                document.getElementById('email-status').style.color = 'red';
                return;
            }
            
            // 邮箱格式验证
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                e.preventDefault();
                document.getElementById('email-status').textContent = '请输入有效的邮箱地址';
                document.getElementById('email-status').style.color = 'red';
            }
        });
    }
    
    // 密码表单处理
    const passwordForm = document.getElementById('password_form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            const currentPassword = document.getElementById('current_password').value;
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                e.preventDefault();
                document.getElementById('password-status').textContent = '所有密码字段都必须填写';
                document.getElementById('password-status').style.color = 'red';
                return;
            }
            
            if (newPassword !== confirmPassword) {
                e.preventDefault();
                document.getElementById('password-status').textContent = '两次输入的新密码不一致';
                document.getElementById('password-status').style.color = 'red';
                return;
            }
            
            if (newPassword.length < 6) {
                e.preventDefault();
                document.getElementById('password-status').textContent = '密码长度必须至少为6个字符';
                document.getElementById('password-status').style.color = 'red';
            }
        });
    }
    
    // ==================== 移动端优化功能 ====================
    
    // 窗口大小改变时重新检测设备类型
    window.addEventListener('resize', function() {
        const newIsMobile = window.innerWidth <= 768;
        if (newIsMobile !== isMobile) {
            location.reload(); // 简单重载页面以应用新的布局
        }
        
        // 横竖屏切换时关闭侧边栏
        if (isMobile && sidebar && sidebar.classList.contains('expanded')) {
            closeSidebar();
        }
    });
    
    // 移动端表单优化
    const allInputs = document.querySelectorAll('input, textarea');
    allInputs.forEach(input => {
        // 防止iOS设备上的缩放
        if (isMobile && input.type !== 'file') {
            input.style.fontSize = '16px';
        }
        
        // 移动端输入焦点优化
        if (isMobile) {
            input.addEventListener('focus', function() {
                // 滚动到输入框位置
                setTimeout(() => {
                    this.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }, 300);
            });
        }
        
        // 触摸设备的输入反馈
        if (isTouch) {
            input.addEventListener('touchstart', function() {
                this.style.transform = 'scale(1.02)';
            });
            
            input.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        }
    });
    
    // 移动端按钮优化
    const allButtons = document.querySelectorAll('button, .submit-btn, .file-upload-btn');
    allButtons.forEach(button => {
        if (isTouch) {
            // 触摸反馈
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
                this.style.opacity = '0.8';
            });
            
            button.addEventListener('touchend', function() {
                setTimeout(() => {
                    this.style.transform = '';
                    this.style.opacity = '';
                }, 150);
            });
        }
        
        // 移动端按钮大小优化
        if (isMobile && !button.classList.contains('code-btn')) {
            button.style.minHeight = '44px';
            button.style.padding = '12px 20px';
        }
    });
    
    // 移动端头像上传优化
    if (avatarUpload && avatarUploadLabel && isMobile) {
        // 移动端文件选择优化
        avatarUploadLabel.addEventListener('click', function(e) {
            e.preventDefault();
            avatarUpload.click();
        });
        
        // 触摸设备的拖拽支持
        if (isTouch) {
            const dropZone = document.querySelector('.current-avatar');
            if (dropZone) {
                dropZone.style.border = '2px dashed rgba(255,255,255,0.5)';
                dropZone.style.cursor = 'pointer';
                
                dropZone.addEventListener('click', function() {
                    avatarUpload.click();
                });
            }
        }
    }
    
    // 移动端滚动优化
    if (isMobile && contentContainer) {
        // 平滑滚动
        contentContainer.style.scrollBehavior = 'smooth';
        contentContainer.style.webkitOverflowScrolling = 'touch';
        
        // 滚动到顶部功能
        let scrollTimeout;
        contentContainer.addEventListener('scroll', function() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                // 可以在这里添加滚动相关的功能
            }, 100);
        });
    }
    
    // 移动端键盘处理
    if (isMobile) {
        // 虚拟键盘显示/隐藏时的处理
        window.addEventListener('resize', function() {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                setTimeout(() => {
                    document.activeElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 300);
            }
        });
        
        // 防止输入时页面缩放
        document.addEventListener('touchstart', function(e) {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        });
        
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(e) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        });
    }
    
    // 性能优化：减少重绘和回流
    if (isMobile) {
        // 使用 requestAnimationFrame 优化动画
        const optimizeAnimation = (element, property, value) => {
            requestAnimationFrame(() => {
                element.style[property] = value;
            });
        };
        
        // 优化滚动性能
        let ticking = false;
        const updateScrollState = () => {
            // 滚动相关的DOM更新
            ticking = false;
        };
        
        if (contentContainer) {
            contentContainer.addEventListener('scroll', () => {
                if (!ticking) {
                    requestAnimationFrame(updateScrollState);
                    ticking = true;
                }
            });
        }
    }
    
    // 移动端访问性优化
    if (isMobile) {
        // 为触摸设备添加适当的ARIA标签
        sidebarToggle && sidebarToggle.setAttribute('aria-label', '打开导航菜单');
        sidebar && sidebar.setAttribute('role', 'navigation');
        sidebar && sidebar.setAttribute('aria-label', '用户设置导航');
        
        // 为移动端用户提供更好的反馈
        const statusMessages = document.querySelectorAll('.status-message');
        statusMessages.forEach(msg => {
            msg.setAttribute('role', 'status');
            msg.setAttribute('aria-live', 'polite');
        });
    }
    
    // 通用触摸反馈处理，修复移动端按钮保持active状态
    if (isTouch && isMobile) {
        const touchButtons = document.querySelectorAll('.submit-btn, .file-upload-btn, .code-btn, #back_button, button');
        
        touchButtons.forEach(button => {
            // 防止重复添加事件监听器
            if (button.hasAttribute('data-touch-handled')) return;
            button.setAttribute('data-touch-handled', 'true');
            
            button.addEventListener('touchstart', function(e) {
                this.classList.add('touch-feedback');
            }, { passive: true });
            
            button.addEventListener('touchend', function(e) {
                const self = this;
                setTimeout(() => {
                    self.classList.remove('touch-feedback');
                }, 150);
            }, { passive: true });
            
            button.addEventListener('touchcancel', function(e) {
                this.classList.remove('touch-feedback');
            }, { passive: true });
            
            // 清除任何可能持续的active状态
            button.addEventListener('blur', function() {
                this.classList.remove('touch-feedback');
            });
        });
        
        // 处理侧边栏切换按钮的特殊情况
        if (sidebarToggle) {
            sidebarToggle.addEventListener('touchstart', function(e) {
                this.classList.add('touch-feedback');
            }, { passive: true });
            
            sidebarToggle.addEventListener('touchend', function(e) {
                const self = this;
                setTimeout(() => {
                    self.classList.remove('touch-feedback');
                }, 150);
            }, { passive: true });
            
            sidebarToggle.addEventListener('touchcancel', function(e) {
                this.classList.remove('touch-feedback');
            }, { passive: true });
        }
    }
});
