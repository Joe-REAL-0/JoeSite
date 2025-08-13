from flask import Blueprint, render_template, request, redirect, url_for, jsonify
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
        # Use current_user object instead of fetching from database
        email = current_user.email
        nickname = current_user.nickname
        register_time = current_user.register_time or "未记录"
        
        # For avatar and friend_link that are not part of the current_user object by default,
        # we still need to fetch them from the database
        with Database('./database.db') as db:
            user_data = db.fetch(email)
            avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
            friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
            
            # Create user_data array with values from current_user
            user_data = [email, nickname, user_data[2]] # email, nickname, password
        
        return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                              status="", avatar=avatar, friend_link=friend_link, friend_link_status="",
                              nickname_status="", email_status="", avatar_status="")
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
                    # 更新current_user中的头像
                    current_user.avatar = unique_filename
                    # 头像更新成功，重定向到用户信息页面
                    return redirect(url_for('user.user_info'))
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
                # 更新current_user中的友链
                current_user.friend_link = friend_link
                # 友链更新成功，重定向到用户信息页面
                return redirect(url_for('user.user_info'))
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
                # 更新current_user中的密码
                current_user.password = new_password
                # 密码更新成功，重定向到用户信息页面
                return redirect(url_for('user.user_info'))
            else:
                return render_template('user_info.html', user_data=user_data, 
                                      register_time=register_time, status="密码更新失败，请稍后重试", 
                                      avatar=avatar, friend_link=friend_link, friend_link_status="")
    except Exception as e:
        print(f"Update password error: {e}")
        return redirect(url_for('auth.login'))
        
@user.route('/update_nickname', methods=['POST'])
@login_required
def update_nickname():
    try:
        email = current_user.email
        new_nickname = request.form.get('new_nickname')
        
        if not new_nickname or len(new_nickname.strip()) == 0:
            with Database('./database.db') as db:
                user_data = db.fetch(email)
                register_time = db.get_user_register_time(email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
            return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                  status="", avatar=avatar, friend_link=friend_link, 
                                  friend_link_status="", nickname_status="昵称不能为空")
        
        with Database('./database.db') as db:
            # 检查昵称是否已被其他用户使用
            if db.nickname_exists(new_nickname, exclude_email=email):
                user_data = db.fetch(email)
                register_time = db.get_user_register_time(email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", nickname_status="该昵称已被其他用户使用，请选择其他昵称")
            
            # 更新昵称
            if db.update_nickname(email, new_nickname):
                # 更新current_user中的昵称
                current_user.nickname = new_nickname
                
                # 昵称更新成功，重定向到用户信息页面
                return redirect(url_for('user.user_info'))
            else:
                user_data = db.fetch(email)
                register_time = db.get_user_register_time(email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", nickname_status="昵称更新失败，请稍后重试")
    except Exception as e:
        print(f"Update nickname error: {e}")
        return redirect(url_for('auth.login'))
        
@user.route('/check_nickname', methods=['POST'])
@login_required
def check_nickname():
    try:
        data = request.get_json()
        nickname = data.get('nickname')
        email = current_user.email
        
        if not nickname:
            return jsonify({'available': False, 'message': '昵称不能为空'}), 400
            
        with Database('./database.db') as db:
            if db.nickname_exists(nickname, exclude_email=email):
                return jsonify({'available': False, 'message': '该昵称已被其他用户使用，请选择其他昵称'}), 200
            else:
                return jsonify({'available': True, 'message': '昵称可用'}), 200
    except Exception as e:
        print(f"Check nickname error: {e}")
        return jsonify({'available': False, 'message': '检查昵称时出错'}), 500

@user.route('/email_verification', methods=['POST'])
@login_required
def email_verification():
    try:
        data = request.get_json()
        email = data.get('email')
        action = data.get('action')  # 用于区分不同的邮箱验证场景
        
        # 从auth模块导入所需功能
        from app.auth import email_dict, legal_characters, clean_expired_codes
        from random import choice
        import time
        import threading
        
        # 清理过期的验证码
        clean_expired_codes()
        
        # 检查邮箱是否已被注册（除了当前用户）
        with Database('./database.db') as db:
            if db.email_exists(email) and email != current_user.email:
                return jsonify({'message': '该邮箱已被注册'}), 400
        
        # 生成验证码
        code = ''.join(choice(legal_characters) for _ in range(8))
        timestamp = time.time()
        
        # 存储验证码和操作类型
        email_dict[email] = [code, timestamp, action]
        
        # 获取邮件服务
        from app import mail, app
        
        # 设置邮件内容
        msg_subject = '来自Joe Site的邮箱验证'
        if action == 'update_email':
            msg_body = f"这是Joe从 www.furryjoe.site 发送的邮箱修改验证邮件\n如非您本人操作请忽略该消息\n\n*感谢你的使用！\n以下是你的验证码\n\n  {code}  \n\n请在 五分钟 内进行验证并完成邮箱修改"
        else:
            msg_body = f"这是Joe从 www.furryjoe.site 发送的身份验证邮件\n如非您本人操作请忽略该消息\n\n*感谢你的来访！\n以下是你的验证码\n\n  {code}  \n\n请在 五分钟 内进行验证"
        
        from flask_mail import Message
        msg = Message(msg_subject, sender='joe_real@qq.com', recipients=[email])
        msg.body = msg_body
        
        # 在新线程中发送邮件
        def send_mail_async():
            try:
                with app.app_context():
                    mail.send(msg)
            except Exception as e:
                print(f"Email send error: {e}")
        
        thread = threading.Thread(target=send_mail_async)
        thread.daemon = True
        thread.start()
        
        return jsonify({'message': '验证码已发送至新邮箱'})
    
    except Exception as e:
        print(f"Email verification error: {e}")
        return jsonify({'message': '验证码发送失败，请稍后重试'}), 500

@user.route('/update_email', methods=['POST'])
@login_required
def update_email():
    try:
        current_email = current_user.email
        new_email = request.form.get('new_email')
        password = request.form.get('password')
        verification_code = request.form.get('verification_code')
        
        if not new_email or not password or not verification_code:
            with Database('./database.db') as db:
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
            return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                  status="", avatar=avatar, friend_link=friend_link, 
                                  friend_link_status="", email_status="请填写所有必要信息")
        
        # 导入验证码相关功能
        from app.auth import email_dict, clean_expired_codes
        import time
        
        # 清理过期的验证码
        clean_expired_codes()
        
        with Database('./database.db') as db:
            # 验证当前密码
            if not db.check(current_email, password):
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", email_status="密码错误")
            
            # 检查新邮箱是否已被使用（除了当前用户）
            if db.email_exists(new_email) and new_email != current_email:
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", email_status="该邮箱已被注册")
            
            # 验证码检查
            if not (new_email in email_dict):
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", email_status="请先获取验证码")
            
            # 检查验证码是否过期
            if email_dict[new_email][1] + 300 < time.time():
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", email_status="验证码已过期，请重新获取")
            
            # 检查验证码是否正确
            if email_dict[new_email][0] != verification_code:
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", email_status="验证码错误，请注意区分大小写")
            
            # 检查验证码操作类型
            if len(email_dict[new_email]) > 2 and email_dict[new_email][2] != 'update_email':
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", email_status="验证码类型错误，请重新获取")
                                      
            # 验证通过，更新邮箱
            if db.update_email(current_email, new_email):
                # 清理验证码
                email_dict.pop(new_email, None)
                
                # 需要更新当前用户的邮箱
                current_user.email = new_email
                
                # 邮箱更新成功，重定向到用户信息页面
                return redirect(url_for('user.user_info'))
            else:
                user_data = db.fetch(current_email)
                register_time = db.get_user_register_time(current_email)
                avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
                friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""
                
                return render_template('user_info.html', user_data=user_data, register_time=register_time, 
                                      status="", avatar=avatar, friend_link=friend_link, 
                                      friend_link_status="", email_status="邮箱更新失败，请稍后重试")
    except Exception as e:
        print(f"Update email error: {e}")
        return redirect(url_for('auth.login'))