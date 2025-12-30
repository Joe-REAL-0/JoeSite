// blog_edit.js - 博客编辑页面脚本
document.addEventListener('DOMContentLoaded', function() {
    console.log('博客编辑页面已加载');
    
    const flaskData = document.getElementById('flask-data');
    const mode = flaskData.dataset.mode;
    const blogId = flaskData.dataset.blogId;
    
    const form = document.getElementById('blog-form');
    const titleInput = document.getElementById('blog-title');
    const contentInput = document.getElementById('blog-content');
    const saveDraftBtn = document.querySelector('.save-draft-btn');
    const publishBtn = document.querySelector('.publish-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const charCount = document.getElementById('char-count');
    
    // 字数统计
    function updateCharCount() {
        const count = contentInput.value.length;
        charCount.textContent = count;
    }
    
    contentInput.addEventListener('input', updateCharCount);
    updateCharCount();
    
    // 工具栏按钮功能
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            const textarea = contentInput;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end);
            let insertText = '';
            
            switch(action) {
                case 'bold':
                    insertText = `**${selectedText || '粗体文本'}**`;
                    break;
                case 'italic':
                    insertText = `*${selectedText || '斜体文本'}*`;
                    break;
                case 'link':
                    insertText = `[${selectedText || '链接文本'}](https://example.com)`;
                    break;
                case 'code':
                    insertText = `\`${selectedText || '代码'}\``;
                    break;
                case 'heading':
                    insertText = `## ${selectedText || '标题'}`;
                    break;
                case 'list':
                    insertText = `- ${selectedText || '列表项'}`;
                    break;
                case 'preview':
                    showPreview();
                    return;
            }
            
            textarea.value = textarea.value.substring(0, start) + insertText + textarea.value.substring(end);
            textarea.focus();
            textarea.setSelectionRange(start + insertText.length, start + insertText.length);
            updateCharCount();
        });
    });
    
    // 预览功能
    function showPreview() {
        // TODO: 实现Markdown预览
        alert('预览功能需要后端支持，暂未实现');
    }
    
    // 保存博客的通用函数
    async function saveBlog(isPublished) {
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        
        if (!title || !content) {
            alert('标题和内容不能为空');
            return;
        }
        
        const buttonToDisable = isPublished ? publishBtn : saveDraftBtn;
        const originalText = buttonToDisable.textContent;
        buttonToDisable.disabled = true;
        buttonToDisable.textContent = '保存中...';
        
        try {
            let url, method;
            if (mode === 'create') {
                url = '/blog/create';
                method = 'POST';
            } else {
                url = `/blog/update/${blogId}`;
                method = 'POST';
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: title,
                    content: content,
                    is_published: isPublished
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(data.message);
                if (mode === 'create' && data.blog_id) {
                    // 创建后跳转到博客详情页（如果是发布）或管理页（如果是草稿）
                    if (isPublished) {
                        window.location.href = `/blog/${data.blog_id}`;
                    } else {
                        window.location.href = '/blog/manage';
                    }
                } else {
                    window.location.href = '/blog/manage';
                }
            } else {
                alert('保存失败: ' + data.message);
                buttonToDisable.disabled = false;
                buttonToDisable.textContent = originalText;
            }
        } catch (error) {
            alert('保存失败: ' + error.message);
            buttonToDisable.disabled = false;
            buttonToDisable.textContent = originalText;
        }
    }
    
    // 保存草稿按钮
    saveDraftBtn.addEventListener('click', function() {
        saveBlog(0);
    });
    
    // 发布按钮
    publishBtn.addEventListener('click', function() {
        saveBlog(1);
    });
    
    // 删除功能
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            if (!confirm('确定要删除这篇文章吗？此操作不可恢复！')) {
                return;
            }
            
            try {
                const response = await fetch(`/blog/delete/${blogId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert(data.message);
                    window.location.href = '/blog/manage';
                } else {
                    alert('删除失败: ' + data.message);
                }
            } catch (error) {
                alert('删除失败: ' + error.message);
            }
        });
    }
    
    // 自动保存草稿（可选功能）
    // TODO: 实现自动保存到localStorage
});
