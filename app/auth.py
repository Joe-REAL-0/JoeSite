from flask import Blueprint, render_template, redirect, url_for, request, session, jsonify, current_app
from flask_login import UserMixin, login_user, logout_user, current_user
from flask_mail import Message
import threading
import os
import json
import secrets
import shutil
import time
from random import choice
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse, urlsplit
from urllib.request import Request, urlopen
import re
from database import Database
from app.email_links import create_email_link_token, peek_email_link_token, pop_email_link_token

# 创建蓝图
auth = Blueprint('auth', __name__)

NICKNAME_PATTERN = re.compile(r'^[\u4e00-\u9fff0-9_]{3,15}$')

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


def render_auth_page(
    active_tab='login',
    login_info=None,
    register_info=None,
    login_status=None,
    register_status=None,
    forgot_status=None,
    reset_status=None,
    reset_token=None,
):
    return render_template(
        'login.html',
        login_info=login_info or ['', ''],
        register_info=register_info or ['', '', ''],
        login_status=login_status,
        register_status=register_status,
        forgot_status=forgot_status,
        reset_status=reset_status,
        reset_token=reset_token or '',
        active_tab=active_tab,
    )


def is_valid_nickname(nickname):
    return bool(nickname and NICKNAME_PATTERN.fullmatch(nickname.strip()))


def _sanitize_nickname(nickname, fallback):
    value = re.sub(r'\s+', ' ', (nickname or '').strip())
    return value[:20] if value else fallback


def _make_unique_nickname(db, base_nickname, github_id):
    candidate = _sanitize_nickname(base_nickname, f'GitHub{github_id}')

    if not db.fetch(candidate):
        return candidate

    suffix_seed = str(github_id)[-4:] if github_id else 'gh'
    for index in range(1, 50):
        suffix = f'_{suffix_seed}{index}'
        trimmed_base = candidate[: max(1, 20 - len(suffix))]
        unique_candidate = f'{trimmed_base}{suffix}'
        if not db.fetch(unique_candidate):
            return unique_candidate

    return f"GitHub{str(github_id)[-6:]}"[:20]


def _safe_next_url(candidate):
    if not candidate:
        return url_for('main.hello')

    parsed = urlparse(candidate)
    if parsed.scheme or parsed.netloc:
        return url_for('main.hello')

    return candidate if candidate.startswith('/') else url_for('main.hello')


def _github_request(url, token=None, method='GET', body=None):
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'JoeSite-GitHub-OAuth',
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'

    data = None
    if body is not None:
        data = urlencode(body).encode('utf-8')
        headers['Content-Type'] = 'application/x-www-form-urlencoded'

    request = Request(url, data=data, headers=headers, method=method)
    with urlopen(request, timeout=15) as response:
        payload = response.read().decode('utf-8')
        return json.loads(payload) if payload else {}


def _download_github_avatar(profile):
    avatar_url = profile.get('avatar_url')
    github_id = str(profile.get('id'))

    if not avatar_url or not github_id:
        return 'default_avatar.png'

    try:
        request = Request(
            avatar_url,
            headers={
                'User-Agent': 'JoeSite-GitHub-OAuth',
                'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
            },
        )
        with urlopen(request, timeout=15) as response:
            content_type = response.headers.get_content_type()
            extension = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/gif': 'gif',
            }.get(content_type, 'png')

            filename = f'github_{github_id}.{extension}'
            upload_folder = current_app.config.get('UPLOAD_FOLDER')
            if not upload_folder:
                return 'default_avatar.png'

            os.makedirs(upload_folder, exist_ok=True)
            file_path = os.path.join(upload_folder, filename)

            with open(file_path, 'wb') as file_handle:
                shutil.copyfileobj(response, file_handle)

            return filename
    except Exception as e:
        print(f'GitHub avatar download error: {e}')
        return 'default_avatar.png'


def _build_email_button_html(title, message, button_text, button_url, hint_text='如果按钮无法点击，请复制链接到浏览器打开'):
        return f"""
<!doctype html>
<html lang=\"zh-CN\">
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>{title}</title>
</head>
<body style=\"margin:0;padding:24px;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#222;\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;\">
        <tr>
            <td style=\"padding:28px;\">
                <h2 style=\"margin:0 0 12px;font-size:22px;line-height:1.35;color:#111827;\">{title}</h2>
                <p style=\"margin:0 0 18px;font-size:15px;line-height:1.75;color:#374151;\">{message}</p>
                <p style=\"margin:0 0 18px;\">
                    <a href=\"{button_url}\" style=\"display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;\">{button_text}</a>
                </p>
                <p style=\"margin:0 0 8px;font-size:13px;color:#6b7280;\">{hint_text}</p>
                <p style=\"margin:0;font-size:13px;word-break:break-all;\">
                    <a href=\"{button_url}\" style=\"color:#2563eb;text-decoration:underline;\">{button_url}</a>
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def _github_exchange_code(code):
    client_id = current_app.config.get('GITHUB_CLIENT_ID')
    client_secret = current_app.config.get('GITHUB_CLIENT_SECRET')
    redirect_uri = current_app.config.get('GITHUB_REDIRECT_URI') or url_for('auth.github_callback', _external=True)

    if not client_id or not client_secret:
        raise RuntimeError('GitHub OAuth 未配置')

    return _github_request(
        'https://github.com/login/oauth/access_token',
        method='POST',
        body={
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': redirect_uri,
        },
    )


def _github_fetch_user(token):
    profile = _github_request('https://api.github.com/user', token=token)
    if not profile or not profile.get('id'):
        raise RuntimeError('无法获取 GitHub 用户信息')
    return profile


def _sync_github_user(profile):
    github_id = str(profile.get('id'))
    github_email = f'github_{github_id}@users.noreply.github.local'
    github_login = profile.get('login') or profile.get('name') or f'GitHub{github_id[-6:]}'

    with Database('./database.db') as db:
        user_data = db.fetch(github_email)
        if not user_data:
            nickname = _make_unique_nickname(db, github_login, github_id)
            from app.utils import get_china_time
            db.insert(github_email, f'github-oauth:{github_id}', nickname, get_china_time())
            user_data = db.fetch(github_email)

        avatar_filename = _download_github_avatar(profile)
        if avatar_filename != 'default_avatar.png':
            db.update_avatar(github_email, avatar_filename)
            user_data = db.fetch(github_email)

    if not user_data:
        raise RuntimeError('GitHub 用户创建失败')

    register_time = user_data[5] if len(user_data) > 5 else None
    avatar = user_data[3] if len(user_data) > 3 and user_data[3] else 'default_avatar.png'
    friend_link = user_data[4] if len(user_data) > 4 and user_data[4] else ''
    return User(user_data[0], user_data[1], user_data[2], register_time, avatar, friend_link)

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
        login_info = info if isinstance(info, list) and len(info) >= 2 else ['', '']
        return render_auth_page(login_info=login_info, active_tab='login')
    return render_auth_page(active_tab='login')

@auth.route('/register')
def register():
    return render_auth_page(active_tab='register')


@auth.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'GET':
        return render_auth_page(active_tab='forgot')

    email = (request.form.get('email') or '').strip()
    if not email:
        return render_auth_page(active_tab='forgot', forgot_status='请输入邮箱地址')

    try:
        with Database('./database.db') as db:
            user_data = db.fetch(email)

        if not user_data:
            return render_auth_page(active_tab='forgot', forgot_status='该邮箱尚未注册，请先注册账号')

        reset_token = create_email_link_token({'purpose': 'reset_password', 'email': email})
        reset_url = url_for('auth.reset_password', token=reset_token, _external=True)

        def send_reset_mail():
            try:
                from app import app, mail

                msg = Message('Joe Site 密码重置', sender='joe_real@qq.com', recipients=[email])
                msg.body = (
                    '这是 Joe Site 发送的密码重置邮件。\n\n'
                    f'请点击下面的链接重置你的密码：\n{reset_url}\n\n'
                    '如果这不是你的操作，请忽略这封邮件。'
                )
                msg.html = _build_email_button_html(
                    title='Joe Site 密码重置',
                    message='这是 Joe Site 发送的密码重置邮件。点击下方按钮即可重置你的密码。',
                    button_text='立即重置密码',
                    button_url=reset_url,
                    hint_text='如果这不是你的操作，请忽略本邮件。',
                )
                with app.app_context():
                    mail.send(msg)
            except Exception as e:
                print(f'Password reset email error: {e}')

        thread = threading.Thread(target=send_reset_mail)
        thread.daemon = True
        thread.start()

        return render_auth_page(active_tab='forgot', forgot_status='重置链接已发送，请注意查收')
    except Exception as e:
        print(f'Forgot password error: {e}')
        return render_auth_page(active_tab='forgot', forgot_status='重置链接发送失败，请稍后重试')


@auth.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    token_record = peek_email_link_token(token)
    if not token_record:
        return render_auth_page(active_tab='login', login_status='重置链接已失效，请重新找回密码')

    payload = token_record.get('payload', {})
    if payload.get('purpose') != 'reset_password':
        return render_auth_page(active_tab='login', login_status='无效的密码重置链接')

    email = (payload.get('email') or '').strip()
    if not email:
        return render_auth_page(active_tab='login', login_status='重置链接信息不完整')

    if request.method == 'GET':
        return render_auth_page(active_tab='reset', reset_token=token)

    new_password = request.form.get('new_password') or ''
    confirm_password = request.form.get('confirm_password') or ''

    if not new_password or not confirm_password:
        return render_auth_page(active_tab='reset', reset_token=token, reset_status='请填写完整的新密码信息')

    if new_password != confirm_password:
        return render_auth_page(active_tab='reset', reset_token=token, reset_status='两次输入的新密码不一致')

    popped_record = pop_email_link_token(token)
    if not popped_record:
        return render_auth_page(active_tab='login', login_status='重置链接已失效，请重新找回密码')

    with Database('./database.db') as db:
        user_data = db.fetch(email)
        if not user_data:
            return render_auth_page(active_tab='login', login_status='该邮箱不存在，请先注册账号')

        if not db.update_password(email, new_password):
            return render_auth_page(active_tab='reset', reset_token=token, reset_status='密码重置失败，请稍后重试')

    return render_auth_page(active_tab='login', login_status='密码已重置，请使用新密码登录')

@auth.route('/login_checker', methods=['POST'])
def login_checker():
    account = request.form.get('account')
    password = request.form.get('password')
    info = [account, password]
    
    if not (account and password):
        return render_auth_page(login_info=info, login_status='请填写完整信息', active_tab='login')
    
    try:
        with Database('./database.db') as db:
            userData = db.fetch(account)
            if userData and db.check(account, password):
                user = User(userData[0], userData[1], userData[2])
                login_user(user)
                session['nickname'] = userData[1]
                return redirect(session.get('next') or url_for('main.hello'))
            else:
                return render_auth_page(login_info=info, login_status='账号或密码错误', active_tab='login')
    except Exception as e:
        print(f"Login checker error: {e}")
        return render_auth_page(login_info=info, login_status='系统错误，请稍后重试', active_tab='login')

@auth.route('/register_checker', methods=['POST'])
def register_checker():
    nickname = (request.form.get('nickname') or '').strip()
    password = request.form.get('password') or ''
    repeat_password = request.form.get('repeat_password') or ''
    Info_list = [nickname, password, repeat_password]

    if not is_valid_nickname(nickname):
        status = '昵称需为3-15位的中文、数字或下划线组合'
    elif password != repeat_password:
        status = '两次输入的密码不一致'
    else:
        try:
            with Database('./database.db') as db:
                if db.nickname_exists(nickname):
                    status = '昵称已被注册'
                else:
                    from app.email_links import create_pending_registration

                    register_token = create_pending_registration({
                        'nickname': nickname,
                        'password': password,
                        'next_url': url_for('main.hello'),
                    })
                    return redirect(url_for('oauth.register_bind_email', register_token=register_token))
        except Exception as e:
            print(f"Register checker error: {e}")
            status = '系统错误，请稍后重试'
    
    return render_auth_page(register_info=Info_list, register_status=status, active_tab='register')


@auth.route('/github_login')
def github_login():
    client_id = current_app.config.get('GITHUB_CLIENT_ID')
    client_secret = current_app.config.get('GITHUB_CLIENT_SECRET')

    if not client_id or not client_secret:
        return render_auth_page(active_tab='login', login_status='GitHub 登录暂未配置，请联系站长')

    state = secrets.token_urlsafe(24)
    session['github_oauth_state'] = state
    session['github_oauth_next'] = _safe_next_url(session.get('next'))

    redirect_uri = current_app.config.get('GITHUB_REDIRECT_URI') or url_for('auth.github_callback', _external=True)
    authorize_url = 'https://github.com/login/oauth/authorize?' + urlencode({
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'scope': 'read:user',
        'state': state,
    })
    return redirect(authorize_url)


@auth.route('/github_callback')
def github_callback():
    error = request.args.get('error')
    if error:
        return render_auth_page(active_tab='login', login_status='GitHub 授权已取消或失败')

    state = request.args.get('state')
    if not state or state != session.pop('github_oauth_state', None):
        return render_auth_page(active_tab='login', login_status='GitHub 登录状态校验失败')

    code = request.args.get('code')
    if not code:
        return render_auth_page(active_tab='login', login_status='GitHub 未返回授权码')

    try:
        token_response = _github_exchange_code(code)
        access_token = token_response.get('access_token')
        if not access_token:
            raise RuntimeError(token_response.get('error_description') or 'GitHub 令牌获取失败')

        profile = _github_fetch_user(access_token)
        user = _sync_github_user(profile)
        login_user(user)
        session['nickname'] = user.nickname
        next_url = _safe_next_url(session.pop('github_oauth_next', None))
        return redirect(next_url)
    except (HTTPError, URLError, ValueError, RuntimeError) as e:
        print(f'GitHub OAuth error: {e}')
        return render_auth_page(active_tab='login', login_status='GitHub 登录失败，请稍后重试')

@auth.route('/email_sender', methods=['POST'])
def send_email():
    try:
        # 清理过期的验证码
        clean_expired_codes()
        
        email = request.get_json()['email']
        code = ''.join(choice(legal_characters) for _ in range(8))
        timestamp = time.time()
        email_dict[email] = [code, timestamp]
        site_url = 'https://www.furryjoe.site'
        
        # 获取应用实例来使用邮件服务
        from app import mail, app
        
        # 设置邮件发送超时
        msg = Message('来自Joe Site的验证邮件', sender='joe_real@qq.com', recipients=[email])
        msg.body = f"这是Joe从 www.furryjoe.site 发送的身份验证邮件\n如非您本人操作请忽略该消息\n\n*感谢你的来访！\n以下是你的验证码\n\n  {code}  \n\n请在 五分钟 内进行验证并完成注册"
        msg.html = _build_email_button_html(
            title='Joe Site 邮箱验证',
            message=(
                '这是 Joe Site 发送的身份验证邮件。<br>'
                f'你的验证码为：<strong style=\"font-size:20px;letter-spacing:2px;\">{code}</strong><br>'
                '请在 5 分钟内完成验证。'
            ),
            button_text='前往 Joe Site',
            button_url=site_url,
            hint_text='如非您本人操作，请忽略本邮件。',
        )
        
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