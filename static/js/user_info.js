document.addEventListener('DOMContentLoaded', () => {
    const menuItems = Array.from(document.querySelectorAll('.menu-item'));
    const sections = Array.from(document.querySelectorAll('.section-content'));
    const panelShell = document.getElementById('user_panel');
    const menuSection = document.getElementById('menu_section');
    const contentSection = document.getElementById('content_section');
    const contentContainer = document.getElementById('content-container');
    const backToMenuButton = document.getElementById('back_to_menu');
    const sectionTitle = document.getElementById('section-title');
    const contentHeader = document.querySelector('.content-header');

    const isContentStage = () => panelShell && panelShell.classList.contains('show-content');

    function setPanelStage(stage) {
        const showContent = stage === 'content';
        if (panelShell) {
            panelShell.classList.toggle('show-content', showContent);
        }
        if (menuSection) {
            menuSection.setAttribute('aria-hidden', showContent ? 'true' : 'false');
        }
        if (contentSection) {
            contentSection.setAttribute('aria-hidden', showContent ? 'false' : 'true');
        }
    }

    function setActiveSection(sectionName, titleText) {
        sections.forEach((section) => {
            section.classList.toggle('active', section.id === `${sectionName}-section`);
        });

        menuItems.forEach((item) => {
            const isActive = item.dataset.section === sectionName;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        if (sectionTitle) {
            sectionTitle.textContent = titleText || sectionName;
        }

        if (contentContainer) {
            contentContainer.scrollTop = 0;
        }
    }

    function showSection(sectionName, titleText) {
        setActiveSection(sectionName, titleText);
        setPanelStage('content');
    }

    function showMenu() {
        setPanelStage('menu');
    }

    menuItems.forEach((item) => {
        item.addEventListener('click', () => {
            const sectionName = item.dataset.section;
            const titleText = item.dataset.title || item.textContent.trim();
            if (sectionName) {
                showSection(sectionName, titleText);
            }
        });

        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const sectionName = item.dataset.section;
                const titleText = item.dataset.title || item.textContent.trim();
                if (sectionName) {
                    showSection(sectionName, titleText);
                }
            }
        });
    });

    if (backToMenuButton) {
        backToMenuButton.addEventListener('click', showMenu);
    }

    if (menuItems.length > 0) {
        const defaultItem = menuItems[0];
        setActiveSection(defaultItem.dataset.section || 'profile', defaultItem.dataset.title || defaultItem.textContent.trim());
        setPanelStage('menu');
    }

    window.addEventListener('wheel', (event) => {
        if (!isContentStage()) return;
        
        const isScrollingContent = event.target.closest('#content-container');
        // If scrolling inside the content container and not at the top, let it scroll normally
        if (isScrollingContent && contentContainer && contentContainer.scrollTop > 0) {
            return;
        }

        // If scrolling up (deltaY < -12) anywhere on the page, or at the top of content container
        if (event.deltaY < -12) {
            // Only prevent default if we are actually handling it
            event.preventDefault();
            showMenu();
        }
    }, { passive: false });

    let touchStartY = null;

    window.addEventListener('touchstart', (event) => {
        if (!isContentStage()) return;
        if (event.touches.length === 1) {
            touchStartY = event.touches[0].clientY;
        }
    }, { passive: true });

    window.addEventListener('touchend', (event) => {
        if (!isContentStage() || touchStartY === null) return;
        
        const deltaY = event.changedTouches[0].clientY - touchStartY;
        touchStartY = null;

        const isTouchingContent = event.target.closest('#content-container');
        
        // If swiping up (deltaY < -60) anywhere outside the content container
        // Or if they are at the top of the content container (though swiping up scrolls down, 
        // the original design relies on swiping up to go back. We only allow it outside content
        // so it doesn't conflict with reading the content).
        if (!isTouchingContent && deltaY < -60) {
            showMenu();
        }
    });

    const nicknameForm = document.getElementById('nickname_form');
    const newNicknameInput = document.getElementById('new_nickname');
    const nicknameStatus = document.getElementById('nickname-status');

    if (nicknameForm && newNicknameInput && nicknameStatus) {
        let nicknameCheckTimeout;

        newNicknameInput.addEventListener('input', function () {
            clearTimeout(nicknameCheckTimeout);
            const nickname = this.value.trim();

            nicknameStatus.textContent = '';
            if (!nickname) {
                this.dataset.available = 'true';
                return;
            }

            nicknameCheckTimeout = setTimeout(() => {
                nicknameStatus.textContent = '检查昵称中...';
                nicknameStatus.style.color = 'var(--text-muted, #999)';

                fetch('/check_nickname', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nickname })
                })
                    .then((response) => response.json())
                    .then((data) => {
                        newNicknameInput.dataset.available = data.available ? 'true' : 'false';
                        nicknameStatus.textContent = data.message || '';
                        nicknameStatus.style.color = data.available ? 'green' : 'red';
                    })
                    .catch(() => {
                        newNicknameInput.dataset.available = 'false';
                        nicknameStatus.textContent = '检查昵称时出错';
                        nicknameStatus.style.color = 'red';
                    });
            }, 350);
        });

        nicknameForm.addEventListener('submit', (event) => {
            const nickname = newNicknameInput.value.trim();
            if (!nickname) {
                event.preventDefault();
                nicknameStatus.textContent = '昵称不能为空';
                nicknameStatus.style.color = 'red';
                return;
            }

            if (newNicknameInput.dataset.available === 'false') {
                event.preventDefault();
                nicknameStatus.textContent = '该昵称已被其他用户使用，请选择其他昵称';
                nicknameStatus.style.color = 'red';
            }
        });
    }

    const emailForm = document.getElementById('email_form');
    if (emailForm) {
        emailForm.addEventListener('submit', (event) => {
            const newEmail = document.getElementById('new_email').value.trim();
            const currentEmail = document.getElementById('current_email').value.trim();
            const password = document.getElementById('password_for_email').value;

            if (!newEmail) {
                event.preventDefault();
                document.getElementById('email-status').textContent = '邮箱不能为空';
                document.getElementById('email-status').style.color = 'red';
                return;
            }

            if (!password) {
                event.preventDefault();
                document.getElementById('email-status').textContent = '请输入密码';
                document.getElementById('email-status').style.color = 'red';
                return;
            }

            if (newEmail === currentEmail) {
                event.preventDefault();
                document.getElementById('email-status').textContent = '新邮箱不能与当前邮箱相同';
                document.getElementById('email-status').style.color = 'red';
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                event.preventDefault();
                document.getElementById('email-status').textContent = '请输入有效的邮箱地址';
                document.getElementById('email-status').style.color = 'red';
            }
        });
    }

    const passwordForm = document.getElementById('password_form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', (event) => {
            const currentPassword = document.getElementById('current_password').value;
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                event.preventDefault();
                document.getElementById('password-status').textContent = '所有密码字段都必须填写';
                document.getElementById('password-status').style.color = 'red';
                return;
            }

            if (newPassword !== confirmPassword) {
                event.preventDefault();
                document.getElementById('password-status').textContent = '两次输入的新密码不一致';
                document.getElementById('password-status').style.color = 'red';
                return;
            }

            if (newPassword.length < 6) {
                event.preventDefault();
                document.getElementById('password-status').textContent = '密码长度必须至少为6个字符';
                document.getElementById('password-status').style.color = 'red';
            }
        });
    }

    const avatarUpload = document.getElementById('avatar_upload');
    const avatarUploadLabel = document.getElementById('avatar_upload_label');
    const fileSelected = document.getElementById('file-selected');
    const userAvatar = document.getElementById('user_avatar');

    if (avatarUpload) {
        avatarUpload.addEventListener('change', () => {
            if (fileSelected) {
                fileSelected.textContent = avatarUpload.files && avatarUpload.files[0] ? avatarUpload.files[0].name : '未选择文件';
            }

            if (avatarUpload.files && avatarUpload.files[0] && userAvatar) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    userAvatar.src = event.target.result;
                };
                reader.readAsDataURL(avatarUpload.files[0]);
            }
        });
    }

    if (avatarUploadLabel && avatarUpload) {
        avatarUploadLabel.addEventListener('click', () => {
            if (fileSelected) {
                fileSelected.textContent = '正在打开相册...';
            }
        });
    }
});
