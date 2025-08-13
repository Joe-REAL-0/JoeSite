from flask import Blueprint, render_template, redirect, url_for, request, session, jsonify
from flask_login import UserMixin, login_user, logout_user, current_user
from flask_mail import Message
import threading
import time
from random import choice
from database import Database

# 创建蓝图
auth = Blueprint('auth', __name__)

# 存储验证码的字典
email_dict = {}

# 合法字符集
legal_characters = ['A', 'B', 'C', 'D',
'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
]

class User(UserMixin):
    def __init__(self, email, nickname, password, register_time=None, avatar=None, friend_link=None):
        self.email = email
        self.nickname = nickname
        self.password = password
        self.register_time = register_time
        self.avatar = avatar or "default_avatar.png"
        self.friend_link = friend_link or "尚未添加友链"
    
    def get_id(self):
        return self.email

def load_user(email):
    with Database('./database.db') as db:
        userData = db.fetch(email)
        if userData:
            # 注意: userData[5] 是 register_time 字段 (email, nickname, password, avatar, friend_link, register_time)
            register_time = userData[5] if len(userData) > 5 else None
            avatar = userData[3] if len(userData) > 3 and userData[3] else "default_avatar.png"
            friend_link = userData[4] if len(userData) > 4 and userData[4] else ""
            return User(userData[0], userData[1], userData[2], register_time, avatar, friend_link)
    return None

# 清理过期验证码
def clean_expired_codes():
    current_time = time.time()
    expired_keys = [key for key, value in email_dict.items() if value[1] + 300 < current_time]
    for key in expired_keys:
        email_dict.pop(key, None)

@auth.route('/login')
def login():
    # 如果是从注册页面过来的，始终重定向到首页
    if session.get('from_register'):
        session['next'] = url_for('main.hello')
        session.pop('from_register')
    elif request.referrer and ('login' not in request.referrer and 'register' not in request.referrer):
        session['next'] = request.referrer
    else:
        session['next'] = url_for('main.hello')
    
    if (session.get('nickname')):
        logout_user()
        session.pop('nickname')
        return redirect(url_for('main.hello'))
    if (session.get('info')):
        info = session.get('info')
        session.pop('info')
        return render_template('login.html', info=info)
    return render_template('login.html', info=['',''])

@auth.route('/register')
def register():
    return render_template('register.html', info=['','','',''])

@auth.route('/login_checker', methods=['POST'])
def login_checker():
    account = request.form.get('account')
    password = request.form.get('password')
    info = [account, password]
    
    if not (account and password):
        return render_template('login.html', info=info, status="请填写完整信息")
    
    try:
        with Database('./database.db') as db:
            userData = db.fetch(account)
            if userData and db.check(account, password):
                user = User(userData[0], userData[1], userData[2])
                login_user(user)
                session['nickname'] = userData[1]
                return redirect(session.get('next') or url_for('main.hello'))
            else:
                return render_template('login.html', info=info, status="账号或密码错误")
    except Exception as e:
        print(f"Login checker error: {e}")
        return render_template('login.html', info=info, status="系统错误，请稍后重试")

@auth.route('/register_checker', methods=['POST'])
def register_checker():
    # 清理过期的验证码
    clean_expired_codes()
    
    email = request.form.get('email')
    nickname = request.form.get('nickname')
    password = request.form.get('password')
    repeat_password = request.form.get('repeat_password')
    Info_list = [email, nickname, password, repeat_password]
    
    if (not email in email_dict):
        status="请先点击获取验证码"
    elif (email_dict[email][1]+300 < time.time()):
        status="验证码已过期，请重新获取"
    elif (email_dict[email][0]!=request.form.get('code')):
        status="验证码错误，请注意区分大小写"
    elif (len(nickname) >= 20):
        status="昵称长度需低于20个字符"
    elif password != repeat_password:
        status="两次输入的密码不一致"
    else:
        try:
            with Database('./database.db') as db:
                if db.fetch(email):
                    status="邮箱已被注册"
                elif db.fetch(nickname):
                    status="昵称已被注册"
                else:
                    # 添加用户，记录东八区（UTC+8）的注册时间
                    from app.utils import get_china_time
                    register_time = get_china_time()
                    db.insert(email, password, nickname, register_time)
                    # 更新头像字段
                    db.update_avatar(email, "default_avatar.png")
                    email_dict.pop(email, None)
                    session['info']=[nickname, password]
                    session['from_register'] = True
                    return redirect(url_for('auth.login'))
        except Exception as e:
            print(f"Register checker error: {e}")
            status="系统错误，请稍后重试"
    
    return render_template('register.html', info=Info_list, status=status)

@auth.route('/email_sender', methods=['POST'])
def send_email():
    try:
        # 清理过期的验证码
        clean_expired_codes()
        
        email = request.get_json()['email']
        code = ''.join(choice(legal_characters) for _ in range(8))
        timestamp = time.time()
        email_dict[email] = [code, timestamp]
        
        # 获取应用实例来使用邮件服务
        from app import mail, app
        
        # 设置邮件发送超时
        msg = Message('来自Joe Site的验证邮件', sender='joe_real@qq.com', recipients=[email])
        msg.body = f"这是Joe从 www.furryjoe.site 发送的身份验证邮件\n如非您本人操作请忽略该消息\n\n*感谢你的来访！\n以下是你的验证码\n\n  {code}  \n\n请在 五分钟 内进行验证并完成注册"
        
        # 在新线程中发送邮件，避免阻塞主线程
        def send_mail_async():
            try:
                with app.app_context():
                    mail.send(msg)
            except Exception as e:
                print(f"Email send error: {e}")
        
        thread = threading.Thread(target=send_mail_async)
        thread.daemon = True
        thread.start()
        
        return jsonify({'message': '验证码已发送'})
        
    except Exception as e:
        print(f"Email sender error: {e}")
        return jsonify({'message': '验证码发送失败'}), 500