document.addEventListener('DOMContentLoaded', function() {
    const avatarUpload = document.getElementById('avatar_upload');
    const userAvatar = document.getElementById('user_avatar');
    const avatarSubmit = document.getElementById('avatar_submit');
    const friendLinkInput = document.getElementById('friend_link_input');
    const friendLinkDisplay = document.getElementById('friend_link');
    const avatarUploadLabel = document.getElementById('avatar_upload_label');

    // 当选择文件后，显示预览
    if (avatarUpload) {
        avatarUpload.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                
                // 检查文件大小，限制在5MB以内，防止移动设备上传大文件卡顿
                if (file.size > 5 * 1024 * 1024) {
                    alert('图片大小不能超过5MB，请选择较小的图片');
                    return;
                }
                
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    userAvatar.src = e.target.result;
                    // 显示上传按钮
                    avatarSubmit.style.display = 'block';
                    // 改变选择按钮文字，提示用户已选择文件
                    avatarUploadLabel.textContent = '更换其他图片';
                }
                
                // 添加错误处理
                reader.onerror = function() {
                    alert('读取文件失败，请重试');
                }
                
                reader.readAsDataURL(file);
            }
        });
    }

    // 初始时隐藏上传按钮，只有当选择了新头像后才显示
    if (avatarSubmit) {
        avatarSubmit.style.display = 'none';
    }
    
    // 为上传标签添加触摸优化
    if (avatarUploadLabel) {
        // 防止触摸设备上的延迟
        avatarUploadLabel.addEventListener('touchstart', function(e) {
            e.preventDefault(); // 防止默认行为可能导致的延迟
        }, {passive: false});
    }
    
    // 如果存在友链输入框和显示区域，初始化友链输入框的值
    if (friendLinkInput && friendLinkDisplay) {
        // 从显示区域获取当前友链值，用于初始化输入框
        friendLinkInput.value = friendLinkDisplay.textContent.trim();
    }
});
