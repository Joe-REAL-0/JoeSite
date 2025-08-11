from flask import Blueprint, render_template, request, redirect, url_for
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
import os
import uuid
from database import Database

user = Blueprint('user', __name__)

# 检查上传文件扩展名是否允许
def allowed_file(filename):
    from app import app
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@user.route('/user_info')
@login_required
def user_info():
    try:
        email = current_user.email
        with Database('./database.db') as db:
            user_data = db.fetch(email)
            # 注册时间暂时不可用，需要修改数据库结构添加注册时间字段
            register_time = "未记录"
            # 获取用户头像
            avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
            # 获取友链
            friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
        return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                              status="", avatar=avatar, friend_link=friend_link, friend_link_status="")
    except Exception as e:
        print(f"User info error: {e}")
        return redirect(url_for('auth.login'))

@user.route('/update_avatar', methods=['POST'])
@login_required
def update_avatar():
    try:
        email = current_user.email
        
        # 检查是否有文件上传
        if 'avatar' not in request.files:
            with Database('./database.db') as db:
                user_data = db.fetch(email)
                register_time = "未记录"
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
            return render_template('user_info.html', user_data=user_data, 
                                  register_time=register_time, status="没有选择文件", 
                                  avatar=avatar, friend_link=friend_link, friend_link_status="")
        
        file = request.files['avatar']
        
        # 检查文件名是否为空
        if file.filename == '':
            with Database('./database.db') as db:
                user_data = db.fetch(email)
                register_time = "未记录"
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
            return render_template('user_info.html', user_data=user_data, 
                                  register_time=register_time, status="没有选择文件", 
                                  avatar=avatar, friend_link=friend_link, friend_link_status="")
        
        # 检查文件类型
        if file and allowed_file(file.filename):
            # 使用安全的文件名并添加随机前缀以避免冲突
            filename = secure_filename(file.filename)
            unique_filename = f"{str(uuid.uuid4())[:8]}_{filename}"
            
            from app import app
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # 保存文件
            file.save(file_path)
            
            # 更新数据库中的头像字段
            with Database('./database.db') as db:
                if db.update_avatar(email, unique_filename):
                    user_data = db.fetch(email)
                    register_time = "未记录"
                    friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                    return render_template('user_info.html', user_data=user_data, 
                                         register_time=register_time, status="头像更新成功", 
                                         avatar=unique_filename, friend_link=friend_link, friend_link_status="")
                else:
                    user_data = db.fetch(email)
                    register_time = "未记录"
                    avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                    friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                    return render_template('user_info.html', user_data=user_data, 
                                          register_time=register_time, status="头像更新失败", 
                                          avatar=avatar, friend_link=friend_link, friend_link_status="")
        else:
            with Database('./database.db') as db:
                user_data = db.fetch(email)
                register_time = "未记录"
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
            return render_template('user_info.html', user_data=user_data, 
                                  register_time=register_time, status="不支持的文件类型", 
                                  avatar=avatar, friend_link=friend_link, friend_link_status="")
                                  
    except Exception as e:
        print(f"Update avatar error: {e}")
        return redirect(url_for('auth.login'))

@user.route('/add_friend_link', methods=['POST'])
@login_required
def add_friend_link():
    try:
        email = current_user.email
        friend_link = request.form.get('friend_link')
        
        with Database('./database.db') as db:
            user_data = db.fetch(email)
            register_time = "未记录"
            # 获取用户头像
            avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
            
            # 更新友链
            if db.update_friend_link(email, friend_link):
                # 重新获取用户数据以获取更新后的友链
                user_data = db.fetch(email)
                friend_link = user_data[4] if len(user_data) > 4 else ""
                return render_template('user_info.html', user_data=user_data, 
                                      register_time=register_time, status="", avatar=avatar, 
                                      friend_link=friend_link, friend_link_status="友链更新成功")
            else:
                friend_link = user_data[4] if len(user_data) > 4 else ""
                return render_template('user_info.html', user_data=user_data, 
                                      register_time=register_time, status="", avatar=avatar, 
                                      friend_link=friend_link, friend_link_status="友链更新失败，请稍后重试")
    except Exception as e:
        print(f"Add friend link error: {e}")
        return redirect(url_for('auth.login'))

@user.route('/update_password', methods=['POST'])
@login_required
def update_password():
    try:
        email = current_user.email
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')
        
        with Database('./database.db') as db:
            user_data = db.fetch(email)
            register_time = "未记录"
            # 获取用户头像
            avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
            # 获取友链
            friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
            
            # 验证当前密码
            if not db.check(email, current_password):
                return render_template('user_info.html', user_data=user_data, 
                                      register_time=register_time, status="当前密码错误", 
                                      avatar=avatar, friend_link=friend_link, friend_link_status="")
            
            # 验证两次输入的新密码是否一致
            if new_password != confirm_password:
                return render_template('user_info.html', user_data=user_data, 
                                      register_time=register_time, status="两次输入的新密码不一致", 
                                      avatar=avatar, friend_link=friend_link, friend_link_status="")
            
            # 更新密码
            if db.update_password(email, new_password):
                return render_template('user_info.html', user_data=user_data, 
                                      register_time=register_time, status="密码更新成功", 
                                      avatar=avatar, friend_link=friend_link, friend_link_status="")
            else:
                return render_template('user_info.html', user_data=user_data, 
                                      register_time=register_time, status="密码更新失败，请稍后重试", 
                                      avatar=avatar, friend_link=friend_link, friend_link_status="")
    except Exception as e:
        print(f"Update password error: {e}")
        return redirect(url_for('auth.login'))