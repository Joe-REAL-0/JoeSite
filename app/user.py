from flask import Blueprint, render_template, request, redirect, url_for, jsonify
from flask_login import login_required, current_user
from flask_mail import Message
from werkzeug.utils import secure_filename
import os
import uuid
import threading
from app.auth import is_valid_nickname, _build_email_button_html
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
        if not is_valid_nickname(nickname):
            return jsonify({'available': False, 'message': '昵称需为3-15位的中文、数字或下划线组合'}), 200
            
        with Database('./database.db') as db:
            if db.nickname_exists(nickname, exclude_email=email):
                return jsonify({'available': False, 'message': '该昵称已被其他用户使用，请选择其他昵称'}), 200
            else:
                return jsonify({'available': True, 'message': '昵称可用'}), 200
    except Exception as e:
        print(f"Check nickname error: {e}")
        return jsonify({'available': False, 'message': '检查昵称时出错'}), 500


def _send_email_link(recipient_email, subject, body, html=None):
    from app import app, mail

    msg = Message(subject, sender='joe_real@qq.com', recipients=[recipient_email])
    msg.body = body
    if html:
        msg.html = html

    def send_mail_async():
        try:
            with app.app_context():
                mail.send(msg)
        except Exception as e:
            print(f"Email send error: {e}")

    thread = threading.Thread(target=send_mail_async)
    thread.daemon = True
    thread.start()


@user.route('/email_verification', methods=['POST'])
@login_required
def email_verification():
    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip()
        if not email:
            return jsonify({'message': '请输入邮箱地址'}), 400

        with Database('./database.db') as db:
            if db.email_exists(email) and email != current_user.email:
                return jsonify({'message': '该邮箱已被注册'}), 400

        from app.email_links import create_email_link_token

        token = create_email_link_token({
            'purpose': 'update_email',
            'current_email': current_user.email,
            'new_email': email,
        })
        verify_url = url_for('oauth.email_link_verify', token=token, _external=True)
        html = _build_email_button_html(
            title='Joe Site 邮箱验证',
            message='这是 Joe Site 发送的邮箱验证邮件。点击下方按钮完成邮箱修改。',
            button_text='完成修改',
            button_url=verify_url,
            hint_text='如果这不是你的操作，请忽略本邮件。',
        )
        _send_email_link(
            email,
            'Joe Site 邮箱验证',
            f'这是 Joe Site 发送的邮箱验证邮件。\n\n请点击下面的按钮完成邮箱修改：\n{verify_url}\n\n如果这不是您的操作，请忽略这封邮件。',
            html,
        )

        return jsonify({'message': '验证链接已发送至新邮箱'})
    
    except Exception as e:
        print(f"Email verification error: {e}")
        return jsonify({'message': '验证链接发送失败，请稍后重试'}), 500

@user.route('/update_email', methods=['POST'])
@login_required
def update_email():
    try:
        current_email = current_user.email
        new_email = (request.form.get('new_email') or '').strip()
        password = request.form.get('password')

        with Database('./database.db') as db:
            user_data = db.fetch(current_email)
            register_time = db.get_user_register_time(current_email)
            avatar = user_data[3] if len(user_data) > 3 and user_data[3] else "default_avatar.png"
            friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ""

            if not new_email or not password:
                return render_template('user_info.html', user_data=user_data, register_time=register_time,
                                      status="", avatar=avatar, friend_link=friend_link,
                                      friend_link_status="", email_status="请填写所有必要信息")

            if not db.check(current_email, password):
                return render_template('user_info.html', user_data=user_data, register_time=register_time,
                                      status="", avatar=avatar, friend_link=friend_link,
                                      friend_link_status="", email_status="密码错误")

            if db.email_exists(new_email) and new_email != current_email:
                return render_template('user_info.html', user_data=user_data, register_time=register_time,
                                      status="", avatar=avatar, friend_link=friend_link,
                                      friend_link_status="", email_status="该邮箱已被注册")

        from app.email_links import create_email_link_token

        token = create_email_link_token({
            'purpose': 'update_email',
            'current_email': current_email,
            'new_email': new_email,
        })
        verify_url = url_for('oauth.email_link_verify', token=token, _external=True)
        html = _build_email_button_html(
            title='Joe Site 邮箱验证',
            message='这是 Joe Site 发送的邮箱验证邮件。点击下方按钮完成邮箱修改。',
            button_text='完成修改',
            button_url=verify_url,
            hint_text='如果这不是你的操作，请忽略本邮件。',
        )
        _send_email_link(
            new_email,
            'Joe Site 邮箱验证',
            f'这是 Joe Site 发送的邮箱验证邮件。\n\n请点击下面的按钮完成邮箱修改：\n{verify_url}\n\n如果这不是您的操作，请忽略这封邮件。',
            html,
        )

        return render_template('user_info.html', user_data=user_data, register_time=register_time,
                              status="", avatar=avatar, friend_link=friend_link,
                              friend_link_status="", email_status="验证链接已发送，请前往新邮箱点击完成修改")
    except Exception as e:
        print(f"Update email error: {e}")
        return redirect(url_for('auth.login'))