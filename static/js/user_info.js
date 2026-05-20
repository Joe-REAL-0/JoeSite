document.addEventListener('DOMContentLoaded', () => {
    const sectionItems = Array.from(document.querySelectorAll('.SectionTitle'));
    const sections = Array.from(document.querySelectorAll('.section-content'));
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const contentContainer = document.getElementById('content-container');

    function showSection(sectionName) {
        sections.forEach((section) => {
            section.classList.remove('active');
        });

        const activeSection = document.getElementById(`${sectionName}-section`);
        if (activeSection) {
            activeSection.classList.add('active');
        }

        sectionItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.section === sectionName);
        });

        if (contentContainer) {
            contentContainer.scrollTop = 0;
        }

        if (sidebar && sidebar.classList.contains('expanded') && window.innerWidth <= 768) {
            sidebar.classList.remove('expanded');
            if (sidebarToggle) {
                sidebarToggle.setAttribute('aria-expanded', 'false');
            }
        }
    }

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            const expanded = sidebar.classList.toggle('expanded');
            sidebarToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
    }

    sectionItems.forEach((item) => {
        item.addEventListener('click', () => {
            const sectionName = item.dataset.section;
            if (sectionName) {
                showSection(sectionName);
            }
        });

        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const sectionName = item.dataset.section;
                if (sectionName) {
                    showSection(sectionName);
                }
            }
        });
    });

    if (sectionItems.length > 0) {
        showSection(sectionItems[0].dataset.section || 'profile');
    }

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
