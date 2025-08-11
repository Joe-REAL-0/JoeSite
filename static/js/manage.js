document.addEventListener('DOMContentLoaded', function() {
    // Check if device is mobile
    const isMobile = window.innerWidth <= 768;
    
    // If mobile device, add mobile class to body
    if (isMobile) {
        document.body.classList.add('mobile-device');
    }
    
    // Setup sidebar toggle button for mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('expanded');
            // Change button text based on sidebar state
            this.textContent = sidebar.classList.contains('expanded') ? '✕' : '☰';
        });
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
        item.addEventListener('click', function() {
            // 移除所有部分标题的活动类
            sectionItems.forEach(el => el.classList.remove('active'));
            
            // 添加活动类到被点击的部分标题
            this.classList.add('active');
            
            // 获取部分ID并显示
            const section = this.getAttribute('data-section');
            showSection(section);
            
            // 在移动设备上，选择后折叠侧边栏
            if (isMobile && sidebar.classList.contains('expanded')) {
                sidebar.classList.remove('expanded');
                sidebarToggle.textContent = '☰';
            }
        });
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
            
            // 根据选中的部分加载相应的数据
            if (sectionId === 'users') {
                loadUsers();
            } else if (sectionId === 'messages') {
                loadMessages();
            } else if (sectionId === 'oc_introduces') {
                loadOCIntroduces();
            }
        }
    }
    
    // 加载用户列表
    function loadUsers() {
        fetch('/api/users')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const usersTableBody = document.querySelector('#users-table tbody');
                    usersTableBody.innerHTML = '';
                    
                    data.users.forEach(user => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${user.email}</td>
                            <td>${user.nickname}</td>
                            <td><img src="/static/images/avatars/${user.avatar}" alt="${user.nickname}" class="avatar-preview"></td>
                            <td>
                                <button class="action-btn" onclick="editUser('${user.email}', '${user.nickname}')">编辑</button>
                                <button class="action-btn delete-btn" onclick="deleteUser('${user.email}')">删除</button>
                            </td>
                        `;
                        usersTableBody.appendChild(row);
                    });
                } else {
                    console.error('Failed to load users:', data.message);
                }
            })
            .catch(error => console.error('Error loading users:', error));
    }
    
    // 加载留言列表
    function loadMessages() {
        fetch('/api/messages')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const messagesTableBody = document.querySelector('#messages-table tbody');
                    messagesTableBody.innerHTML = '';
                    
                    data.messages.forEach(message => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${message.id}</td>
                            <td>${message.nickname}</td>
                            <td>${message.time}</td>
                            <td>${message.content}</td>
                            <td>
                                <button class="action-btn delete-btn" onclick="deleteMessage(${message.id})">删除</button>
                            </td>
                        `;
                        messagesTableBody.appendChild(row);
                    });
                } else {
                    console.error('Failed to load messages:', data.message);
                }
            })
            .catch(error => console.error('Error loading messages:', error));
    }
    
    // 加载OC档案条目
    function loadOCIntroduces() {
        fetch('/api/oc_introduces')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const ocTableBody = document.querySelector('#oc-table tbody');
                    ocTableBody.innerHTML = '';
                    
                    data.oc_introduces.forEach(oc => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${oc.id}</td>
                            <td>${oc.title}</td>
                            <td>${oc.order_id}</td>
                            <td>
                                <button class="action-btn" onclick="editOC(${oc.id}, '${oc.title}', ${oc.order_id})">编辑</button>
                                <button class="action-btn delete-btn" onclick="deleteOC(${oc.id})">删除</button>
                            </td>
                        `;
                        ocTableBody.appendChild(row);
                    });
                } else {
                    console.error('Failed to load OC introduces:', data.message);
                }
            })
            .catch(error => console.error('Error loading OC introduces:', error));
    }
    
    // 初始化搜索框
    setupSearch('user-search', 'users-table');
    setupSearch('message-search', 'messages-table');
    
    // 添加OC条目按钮事件
    document.getElementById('add-oc').addEventListener('click', function() {
        document.getElementById('oc-modal-title').textContent = '添加新档案条目';
        document.getElementById('edit-oc-id').value = '';
        document.getElementById('edit-oc-title').value = '';
        document.getElementById('edit-oc-order').value = '';
        document.getElementById('edit-oc-content').value = '';
        showModal('edit-oc-modal');
    });
    
    // 设置模态框关闭按钮
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            hideModal(modal.id);
        });
    });
    
    // 设置模态框点击外部关闭
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // 提交编辑用户表单
    document.getElementById('edit-user-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('edit-user-email').value;
        const nickname = document.getElementById('edit-user-nickname').value;
        
        updateUser(email, nickname);
    });
    
    // 提交编辑OC条目表单
    document.getElementById('edit-oc-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('edit-oc-id').value;
        const title = document.getElementById('edit-oc-title').value;
        const orderId = document.getElementById('edit-oc-order').value;
        const content = document.getElementById('edit-oc-content').value;
        
        if (id) {
            updateOC(id, title, content, orderId);
        } else {
            createOC(title, content, orderId);
        }
    });
    
    // 将函数暴露到全局作用域
    window.editUser = editUser;
    window.deleteUser = deleteUser;
    window.deleteMessage = deleteMessage;
    window.editOC = editOC;
    window.deleteOC = deleteOC;
    window.loadUsers = loadUsers;
    window.loadMessages = loadMessages;
    window.loadOCIntroduces = loadOCIntroduces;
});

// 设置搜索功能
function setupSearch(searchId, tableId) {
    const searchInput = document.getElementById(searchId);
    if (searchInput) {
        searchInput.addEventListener('keyup', function() {
            const searchTerm = this.value.toLowerCase();
            const table = document.getElementById(tableId);
            const rows = table.getElementsByTagName('tr');
            
            for (let i = 1; i < rows.length; i++) {
                let matchFound = false;
                const cells = rows[i].getElementsByTagName('td');
                
                for (let j = 0; j < cells.length; j++) {
                    const cellText = cells[j].textContent || cells[j].innerText;
                    if (cellText.toLowerCase().indexOf(searchTerm) > -1) {
                        matchFound = true;
                        break;
                    }
                }
                
                rows[i].style.display = matchFound ? '' : 'none';
            }
        });
    }
}

// 显示模态框
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
}

// 隐藏模态框
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
}

// 编辑用户
function editUser(email, nickname) {
    document.getElementById('edit-user-email').value = email;
    document.getElementById('edit-user-nickname').value = nickname;
    
    // 加载该用户的留言
    fetch(`/api/user_messages/${nickname}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const userMessagesTable = document.querySelector('#user-messages-table tbody');
                userMessagesTable.innerHTML = '';
                
                if (data.messages.length === 0) {
                    const row = document.createElement('tr');
                    row.innerHTML = '<td colspan="3">该用户没有留言</td>';
                    userMessagesTable.appendChild(row);
                } else {
                    data.messages.forEach(message => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${message.time}</td>
                            <td>${message.content}</td>
                            <td>
                                <button class="action-btn delete-btn" onclick="deleteMessage(${message.id})">删除</button>
                            </td>
                        `;
                        userMessagesTable.appendChild(row);
                    });
                }
            } else {
                console.error('Failed to load user messages:', data.message);
            }
        })
        .catch(error => console.error('Error loading user messages:', error));
    
    showModal('edit-user-modal');
}

// 更新用户信息
function updateUser(email, nickname) {
    fetch(`/api/user/${email}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            nickname: nickname
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideModal('edit-user-modal');
            loadUsers();
            alert('用户信息已更新');
        } else {
            alert('更新用户信息失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error updating user:', error);
        alert('更新用户信息失败');
    });
}

// 删除用户
function deleteUser(email) {
    if (confirm('确定要删除该用户吗？此操作不可恢复。')) {
        fetch(`/api/user/${email}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadUsers();
                alert('用户已删除');
            } else {
                alert('删除用户失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error deleting user:', error);
            alert('删除用户失败');
        });
    }
}

// 删除留言
function deleteMessage(messageId) {
    if (confirm('确定要删除该留言吗？此操作不可恢复。')) {
        fetch(`/api/messages/${messageId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadMessages();
                // 如果当前显示的是用户编辑模态框，重新加载用户留言
                if (document.getElementById('edit-user-modal').style.display === 'block') {
                    const nickname = document.getElementById('edit-user-nickname').value;
                    editUser(document.getElementById('edit-user-email').value, nickname);
                }
                alert('留言已删除');
            } else {
                alert('删除留言失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error deleting message:', error);
            alert('删除留言失败');
        });
    }
}

// 编辑OC条目
function editOC(id, title, orderId) {
    document.getElementById('oc-modal-title').textContent = '编辑档案条目';
    document.getElementById('edit-oc-id').value = id;
    document.getElementById('edit-oc-title').value = title;
    document.getElementById('edit-oc-order').value = orderId;
    
    // 获取条目内容
    fetch('/api/oc_introduces')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const ocData = data.oc_introduces.find(oc => oc.id == id);
                if (ocData) {
                    document.getElementById('edit-oc-content').value = ocData.content;
                }
            }
        });
    
    showModal('edit-oc-modal');
}

// 创建新OC条目
function createOC(title, content, orderId) {
    fetch('/api/oc_introduces', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: title,
            content: content,
            order_id: orderId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideModal('edit-oc-modal');
            loadOCIntroduces();
            alert('档案条目已创建');
        } else {
            alert('创建档案条目失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error creating OC introduce:', error);
        alert('创建档案条目失败');
    });
}

// 更新OC条目
function updateOC(id, title, content, orderId) {
    fetch(`/api/oc_introduces/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: title,
            content: content,
            order_id: orderId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideModal('edit-oc-modal');
            loadOCIntroduces();
            alert('档案条目已更新');
        } else {
            alert('更新档案条目失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error updating OC introduce:', error);
        alert('更新档案条目失败');
    });
}

// 删除OC条目
function deleteOC(id) {
    if (confirm('确定要删除该档案条目吗？此操作不可恢复。')) {
        fetch(`/api/oc_introduces/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadOCIntroduces();
                alert('档案条目已删除');
            } else {
                alert('删除档案条目失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error deleting OC introduce:', error);
            alert('删除档案条目失败');
        });
    }
}
