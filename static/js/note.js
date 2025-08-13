document.addEventListener('DOMContentLoaded', function() {
    
    // 字符计数器
    const flaskData = document.getElementById('flask-data');
    const userMessageCount = parseInt(flaskData.getAttribute('data-user-message-count') || '0', 10);

    const countValue = document.getElementById('user_message_count_value');
    countValue.textContent = userMessageCount;
    
    const textarea = document.getElementById('input_area');
    const charCount = document.getElementById('char_count');
    const submitButton = document.getElementById('submit_button');
    const noteForm = document.getElementById('note_form');
    
    // 初始状态下，如果文本框为空，禁用提交按钮
    if (!textarea.value.trim()) {
        submitButton.disabled = true;
    }
    
    // 添加表单提交验证
    noteForm.addEventListener('submit', function(e) {
        if (userMessageCount >= 5) {
            e.preventDefault();
            alert("您已达到最大留言限制（5条）");
            return false;
        }
        
        // 检查是否为空留言
        if (!textarea.value.trim()) {
            e.preventDefault();
            alert("留言内容不能为空");
            return false;
        }
        return true;
    });
    
    textarea.addEventListener('input', function() {
        const count = textarea.value.length;
        charCount.textContent = count;
        
        // 如果用户已经有5条留言或者已经达到字符上限或内容为空，禁用提交按钮
        if (userMessageCount >= 5 || count > 200 || !textarea.value.trim()) {
            submitButton.disabled = true;
        } else {
            submitButton.disabled = false;
        }
    });
    
    // 如果用户已经有5条留言，禁用表单
    if (userMessageCount >= 5) {
        console.log("Disabling form because user has reached message limit");
        textarea.disabled = true;
        submitButton.disabled = true;
        textarea.placeholder = "你已达到最大留言数量限制（5条）";
    }
});