import hashlib
import hmac
import json
import os
import secrets
import shutil
import threading
import time
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, jsonify, redirect, render_template, request, session, url_for
from flask_login import login_user, current_user
from flask_mail import Message

from app.auth import User, render_auth_page, _build_email_button_html
from app.email_links import (
    create_email_link_token,
    create_pending_oauth_binding,
    peek_pending_oauth_binding,
    peek_pending_registration,
    pop_email_link_token,
    pop_pending_oauth_binding,
    pop_pending_registration,
)
from app.utils import get_china_time
from database import Database

oauth = Blueprint('oauth', __name__)


def _safe_next_url(candidate):
    if not candidate:
        return url_for('main.hello')

    parsed = urlparse(candidate)
    if parsed.scheme or parsed.netloc:
        return url_for('main.hello')

    return candidate if candidate.startswith('/') else url_for('main.hello')


def _request_json(url, token=None, method='GET', body=None, extra_headers=None):
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'JoeSite-OAuth',
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if extra_headers:
        headers.update(extra_headers)

    data = None
    if body is not None:
        data = urlencode(body).encode('utf-8')
        headers['Content-Type'] = 'application/x-www-form-urlencoded'

    request = Request(url, data=data, headers=headers, method=method)
    with urlopen(request, timeout=15) as response:
        payload = response.read().decode('utf-8')
        return json.loads(payload) if payload else {}


def _provider_config(provider):
    provider = provider.lower()
    if provider == 'github':
        return {
            'client_id': current_app.config.get('GITHUB_CLIENT_ID'),
            'client_secret': current_app.config.get('GITHUB_CLIENT_SECRET'),
            'redirect_uri': current_app.config.get('GITHUB_REDIRECT_URI') or url_for('oauth.oauth_callback', provider='github', _external=True),
            'authorize_url': 'https://github.com/login/oauth/authorize',
            'token_url': 'https://github.com/login/oauth/access_token',
            'scope': 'read:user user:email',
        }
    if provider == 'google':
        return {
            'client_id': current_app.config.get('GOOGLE_CLIENT_ID'),
            'client_secret': current_app.config.get('GOOGLE_CLIENT_SECRET'),
            'redirect_uri': current_app.config.get('GOOGLE_REDIRECT_URI') or url_for('oauth.oauth_callback', provider='google', _external=True),
            'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'scope': 'openid email profile',
        }
    if provider == 'discord':
        return {
            'client_id': current_app.config.get('DISCORD_CLIENT_ID'),
            'client_secret': current_app.config.get('DISCORD_CLIENT_SECRET'),
            'redirect_uri': current_app.config.get('DISCORD_REDIRECT_URI') or url_for('oauth.oauth_callback', provider='discord', _external=True),
            'authorize_url': 'https://discord.com/oauth2/authorize',
            'token_url': 'https://discord.com/api/oauth2/token',
            'scope': 'identify email',
        }
    if provider == 'telegram':
        return {
            'bot_token': current_app.config.get('TELEGRAM_BOT_TOKEN'),
            'bot_username': current_app.config.get('TELEGRAM_BOT_USERNAME'),
            'redirect_uri': current_app.config.get('TELEGRAM_REDIRECT_URI') or url_for('oauth.telegram_callback', _external=True),
        }
    return None


def _download_remote_avatar(avatar_url, prefix, identifier):
    if not avatar_url or not identifier:
        return 'default_avatar.png'

    try:
        request = Request(
            avatar_url,
            headers={
                'User-Agent': 'JoeSite-OAuth',
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

            filename = f'{prefix}_{identifier}.{extension}'
            upload_folder = current_app.config.get('UPLOAD_FOLDER')
            if not upload_folder:
                return 'default_avatar.png'

            os.makedirs(upload_folder, exist_ok=True)
            file_path = os.path.join(upload_folder, filename)
            with open(file_path, 'wb') as file_handle:
                shutil.copyfileobj(response, file_handle)
            return filename
    except Exception as e:
        print(f'OAuth avatar download error: {e}')
        return 'default_avatar.png'


def _resolve_github_email(token):
    emails = _request_json(
        'https://api.github.com/user/emails',
        token=token,
        extra_headers={'Accept': 'application/vnd.github+json'},
    )
    if isinstance(emails, list):
        for item in emails:
            if item.get('primary') and item.get('verified') and item.get('email'):
                return item.get('email')
        for item in emails:
            if item.get('verified') and item.get('email'):
                return item.get('email')
        for item in emails:
            if item.get('email'):
                return item.get('email')
    return None


def _fetch_provider_profile(provider, token):
    provider = provider.lower()
    if provider == 'github':
        profile = _request_json('https://api.github.com/user', token=token, extra_headers={'Accept': 'application/vnd.github+json'})
        if not profile or not profile.get('id'):
            raise RuntimeError('无法获取 GitHub 用户信息')
        profile['email'] = profile.get('email') or _resolve_github_email(token)
        return profile
    if provider == 'google':
        profile = _request_json('https://openidconnect.googleapis.com/v1/userinfo', token=token)
        if not profile or not profile.get('sub'):
            raise RuntimeError('无法获取 Google 用户信息')
        return profile
    if provider == 'discord':
        profile = _request_json('https://discord.com/api/users/@me', token=token)
        if not profile or not profile.get('id'):
            raise RuntimeError('无法获取 Discord 用户信息')
        return profile
    raise RuntimeError('不支持的第三方登录提供方')


def _normalize_profile(provider, profile):
    provider = provider.lower()
    provider_user_id = str(profile.get('id') or profile.get('sub') or '')
    if not provider_user_id:
        raise RuntimeError('第三方账号标识缺失')

    if provider == 'github':
        display_name = profile.get('name') or profile.get('login') or f'GitHub{provider_user_id[-6:]}'
        avatar_url = profile.get('avatar_url')
        email = profile.get('email') or ''
    elif provider == 'google':
        display_name = profile.get('name') or profile.get('given_name') or f'Google{provider_user_id[-6:]}'
        avatar_url = profile.get('picture')
        email = profile.get('email') or ''
    elif provider == 'discord':
        display_name = profile.get('global_name') or profile.get('username') or f'Discord{provider_user_id[-6:]}'
        avatar_hash = profile.get('avatar')
        avatar_url = f"https://cdn.discordapp.com/avatars/{provider_user_id}/{avatar_hash}.png?size=256" if avatar_hash else None
        email = profile.get('email') or ''
    elif provider == 'telegram':
        first_name = profile.get('first_name') or ''
        last_name = profile.get('last_name') or ''
        display_name = (f'{first_name} {last_name}').strip() or profile.get('username') or f'Telegram{provider_user_id[-6:]}'
        avatar_url = profile.get('photo_url')
        email = profile.get('email') or ''
    else:
        raise RuntimeError('不支持的第三方登录提供方')

    return {
        'provider': provider,
        'provider_user_id': provider_user_id,
        'display_name': display_name,
        'avatar_url': avatar_url,
        'email': email,
        'raw_profile': profile,
    }


def _provider_session_states():
    states = session.get('oauth_states')
    if not isinstance(states, dict):
        states = {}
    return states


def _set_provider_state(provider, state):
    states = _provider_session_states()
    states[provider] = state
    session['oauth_states'] = states


def _pop_provider_state(provider):
    states = _provider_session_states()
    expected = states.pop(provider, None)
    session['oauth_states'] = states
    return expected


def _oauth_build_user(email, profile_info, user_row=None):
    if user_row:
        register_time = user_row[5] if len(user_row) > 5 else None
        avatar = user_row[3] if len(user_row) > 3 and user_row[3] else 'default_avatar.png'
        friend_link = user_row[4] if len(user_row) > 4 and user_row[4] else ''
        nickname = user_row[1]
        password = user_row[2]
    else:
        register_time = get_china_time()
        nickname = profile_info['display_name']
        password = ''
        avatar = 'default_avatar.png'
        friend_link = ''

    user = User(email, nickname, password, register_time, avatar, friend_link)
    return user


def _ensure_site_account_for_profile(db, email, profile_info):
    user_row = db.fetch(email)
    avatar_filename = _download_remote_avatar(profile_info.get('avatar_url'), profile_info['provider'], profile_info['provider_user_id'])

    if not user_row:
        db.insert(email, '', profile_info['display_name'], get_china_time())
        if avatar_filename != 'default_avatar.png':
            db.update_avatar(email, avatar_filename)
        user_row = db.fetch(email)
    return user_row, avatar_filename


def _finalize_oauth_binding(binding_token, email):
    binding = pop_pending_oauth_binding(binding_token)
    if not binding:
        return None, '绑定链接已失效，请重新发起第三方登录', None, None

    payload = binding.get('payload', {})
    provider = payload.get('provider')
    provider_user_id = payload.get('provider_user_id')
    if not provider or not provider_user_id:
        return None, '第三方登录信息不完整', None, None

    with Database('./database.db') as db:
        user_row, avatar_filename = _ensure_site_account_for_profile(db, email, payload)
        db.upsert_oauth_account(
            provider,
            provider_user_id,
            email,
            payload.get('display_name', ''),
            avatar_filename,
            json.dumps(payload.get('raw_profile', {}), ensure_ascii=False),
        )

    if not user_row:
        return None, '站内账号创建失败', None, None

    user = _oauth_build_user(email, payload, user_row)
    return user, None, payload.get('next_url'), provider


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
            print(f'Email send error: {e}')

    thread = threading.Thread(target=send_mail_async)
    thread.daemon = True
    thread.start()


def _start_standard_oauth(provider):
    config = _provider_config(provider)
    if not config or not config.get('client_id') or not config.get('client_secret'):
        return render_auth_page(active_tab='login', login_status=f'{provider.title()} 登录暂未配置，请联系站长')

    state = secrets.token_urlsafe(24)
    _set_provider_state(provider, state)
    session['oauth_next'] = _safe_next_url(session.get('next'))

    authorize_url = config['authorize_url'] + '?' + urlencode({
        'client_id': config['client_id'],
        'redirect_uri': config['redirect_uri'],
        'response_type': 'code',
        'scope': config['scope'],
        'state': state,
    })
    if provider == 'google':
        authorize_url += '&prompt=consent&access_type=offline&include_granted_scopes=true'
    return redirect(authorize_url)


def _exchange_code(provider, code):
    config = _provider_config(provider)
    if provider == 'github':
        return _request_json(
            config['token_url'],
            method='POST',
            body={
                'client_id': config['client_id'],
                'client_secret': config['client_secret'],
                'code': code,
                'redirect_uri': config['redirect_uri'],
            },
            extra_headers={'Accept': 'application/json'},
        )

    return _request_json(
        config['token_url'],
        method='POST',
        body={
            'client_id': config['client_id'],
            'client_secret': config['client_secret'],
            'code': code,
            'redirect_uri': config['redirect_uri'],
            'grant_type': 'authorization_code',
        },
    )


def _handle_oauth_login(provider, profile_info):
    provider = provider.lower()
    with Database('./database.db') as db:
        linked_account = db.fetch_oauth_account(provider, profile_info['provider_user_id'])
        if linked_account:
            email = linked_account[2]
            user_row = db.fetch(email)
            if not user_row:
                user_row, _ = _ensure_site_account_for_profile(db, email, profile_info)
            if user_row:
                user = _oauth_build_user(email, profile_info, user_row)
                login_user(user)
                session['nickname'] = user.nickname
                session['oauth_provider'] = provider
                return redirect(_safe_next_url(session.pop('oauth_next', None)))

    binding_token = create_pending_oauth_binding({
        'provider': provider,
        'provider_user_id': profile_info['provider_user_id'],
        'display_name': profile_info['display_name'],
        'avatar_url': profile_info.get('avatar_url'),
        'raw_profile': profile_info.get('raw_profile', {}),
        'suggested_email': profile_info.get('email', ''),
        'next_url': _safe_next_url(session.pop('oauth_next', None)),
    })
    return redirect(url_for('oauth.oauth_bind_email', binding_token=binding_token))


@oauth.route('/register/bind/<register_token>', methods=['GET', 'POST'])
def register_bind_email(register_token):
    pending = peek_pending_registration(register_token)
    if not pending:
        return render_auth_page(active_tab='register', register_status='注册链接已失效，请重新提交注册')

    payload = pending.get('payload', {})
    nickname = payload.get('nickname', '')
    status = ''

    if request.method == 'POST':
        email = (request.form.get('email') or '').strip()
        if not email:
            status = '请输入邮箱地址'
        else:
            with Database('./database.db') as db:
                if db.email_exists(email):
                    status = '邮箱已被注册'
                elif db.nickname_exists(nickname):
                    status = '昵称已被注册，请重新注册'
                else:
                    link_token = create_email_link_token({
                        'purpose': 'register',
                        'register_token': register_token,
                        'email': email,
                    })
                    verify_url = url_for('oauth.email_link_verify', token=link_token, _external=True)
                    html = _build_email_button_html(
                        title='Joe Site 注册验证',
                        message='这是 Joe Site 发送的邮箱注册验证邮件。点击下方按钮完成注册。',
                        button_text='完成注册',
                        button_url=verify_url,
                        hint_text='如果这不是你的操作，请忽略本邮件。',
                    )
                    _send_email_link(
                        email,
                        '来自Joe Site的注册验证邮件',
                        f'这是 Joe Site 发送的邮箱注册验证邮件。\n\n请点击下面的按钮完成注册：\n{verify_url}\n\n如果这不是您本人操作，请忽略该邮件。',
                        html,
                    )
                    status = '验证链接已发送，请前往邮箱点击完成注册'

    return render_template(
        'bind_email.html',
        bind_mode='register',
        action_url=url_for('oauth.register_bind_email', register_token=register_token),
        suggested_email='',
        status=status,
        display_name=nickname,
        intro_text='请填写要绑定的邮箱。验证链接会自动发送到该邮箱。',
        submit_text='发送验证链接',
        back_url=url_for('auth.register'),
    )


@oauth.route('/oauth/<provider>/login')
def oauth_login(provider):
    provider = provider.lower()
    if provider == 'telegram':
        return redirect(url_for('oauth.telegram_login'))
    if provider not in {'github', 'google', 'discord'}:
        return render_auth_page(active_tab='login', login_status='暂不支持该第三方登录方式')
    return _start_standard_oauth(provider)


@oauth.route('/oauth/<provider>/callback')
def oauth_callback(provider):
    provider = provider.lower()
    if provider not in {'github', 'google', 'discord'}:
        return render_auth_page(active_tab='login', login_status='暂不支持该第三方登录方式')

    error = request.args.get('error')
    if error:
        return render_auth_page(active_tab='login', login_status=f'{provider.title()} 授权已取消或失败')

    state = request.args.get('state')
    expected_state = _pop_provider_state(provider)
    if not state or state != expected_state:
        return render_auth_page(active_tab='login', login_status=f'{provider.title()} 登录状态校验失败')

    code = request.args.get('code')
    if not code:
        return render_auth_page(active_tab='login', login_status=f'{provider.title()} 未返回授权码')

    try:
        token_response = _exchange_code(provider, code)
        access_token = token_response.get('access_token')
        if not access_token:
            raise RuntimeError(token_response.get('error_description') or f'{provider.title()} 令牌获取失败')

        raw_profile = _fetch_provider_profile(provider, access_token)
        profile_info = _normalize_profile(provider, raw_profile)

        if provider == 'github' and not profile_info.get('email'):
            profile_info['email'] = raw_profile.get('email') or ''

        return _handle_oauth_login(provider, profile_info)
    except Exception as e:
        print(f'{provider.title()} OAuth error: {e}')
        return render_auth_page(active_tab='login', login_status=f'{provider.title()} 登录失败，请稍后重试')


@oauth.route('/oauth/telegram/login')
def telegram_login():
    config = _provider_config('telegram')
    if not config or not config.get('bot_username') or not config.get('bot_token'):
        return render_auth_page(active_tab='login', login_status='Telegram 登录暂未配置，请联系站长')

    session['oauth_next'] = _safe_next_url(session.get('next'))
    return render_template(
        'telegram_login.html',
        bot_username=config['bot_username'],
        auth_url=config['redirect_uri'],
    )


def _verify_telegram_payload(payload):
    config = _provider_config('telegram')
    bot_token = config.get('bot_token')
    if not bot_token:
        raise RuntimeError('Telegram 登录未配置')

    payload = dict(payload)
    provided_hash = payload.pop('hash', None)
    if not provided_hash:
        raise RuntimeError('Telegram 登录数据不完整')

    auth_date = int(payload.get('auth_date', '0') or 0)
    if not auth_date or time.time() - auth_date > 86400:
        raise RuntimeError('Telegram 登录已过期')

    check_data = '\n'.join(f'{key}={value}' for key, value in sorted(payload.items()))
    secret_key = hashlib.sha256(bot_token.encode('utf-8')).digest()
    calculated_hash = hmac.new(secret_key, check_data.encode('utf-8'), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated_hash, provided_hash):
        raise RuntimeError('Telegram 登录校验失败')

    profile = {
        'id': payload.get('id'),
        'username': payload.get('username'),
        'first_name': payload.get('first_name'),
        'last_name': payload.get('last_name'),
        'photo_url': payload.get('photo_url'),
        'email': payload.get('email', ''),
    }
    if not profile['id']:
        raise RuntimeError('Telegram 用户标识缺失')
    return profile


@oauth.route('/oauth/telegram/callback')
def telegram_callback():
    error = request.args.get('error')
    if error:
        return render_auth_page(active_tab='login', login_status='Telegram 授权已取消或失败')

    try:
        raw_profile = _verify_telegram_payload(request.args.to_dict(flat=True))
        profile_info = _normalize_profile('telegram', raw_profile)
        return _handle_oauth_login('telegram', profile_info)
    except Exception as e:
        print(f'Telegram OAuth error: {e}')
        return render_auth_page(active_tab='login', login_status='Telegram 登录失败，请稍后重试')


@oauth.route('/oauth/bind/<binding_token>', methods=['GET', 'POST'])
def oauth_bind_email(binding_token):
    binding = peek_pending_oauth_binding(binding_token)
    if not binding:
        return render_auth_page(active_tab='login', login_status='第三方绑定链接已失效，请重新登录')

    payload = binding.get('payload', {})
    provider = payload.get('provider', 'oauth')
    suggested_email = payload.get('suggested_email', '')
    status = ''

    if request.method == 'POST':
        email = (request.form.get('email') or '').strip()
        if not email:
            status = '请输入邮箱地址'
        else:
            link_token = create_email_link_token({
                'purpose': 'oauth_bind',
                'binding_token': binding_token,
                'email': email,
            })
            verify_url = url_for('oauth.email_link_verify', token=link_token, _external=True)
            html = _build_email_button_html(
                title='Joe Site 邮箱绑定验证',
                message='这是 Joe Site 发送的邮箱绑定验证邮件。点击下方按钮完成邮箱绑定。',
                button_text='完成绑定',
                button_url=verify_url,
                hint_text='如果这不是你的操作，请忽略本邮件。',
            )
            _send_email_link(
                email,
                'Joe Site 邮箱绑定验证',
                f'这是 Joe Site 发送的邮箱绑定验证邮件。\n\n请点击下面的按钮完成邮箱绑定：\n{verify_url}\n\n如果这不是你的操作，请忽略这封邮件。',
                html,
            )
            status = '验证链接已发送，请前往邮箱点击完成绑定'

    return render_template(
        'bind_email.html',
        bind_mode='oauth',
        action_url=url_for('oauth.oauth_bind_email', binding_token=binding_token),
        suggested_email=suggested_email,
        status=status,
        display_name=payload.get('display_name', ''),
        intro_text=f"当前第三方账号：{payload.get('display_name', '未命名账号')}。请填写你要绑定的邮箱，验证链接会自动发送到该邮箱。",
        submit_text='发送验证链接',
        back_url=url_for('auth.login'),
    )


@oauth.route('/email_link/<token>')
def email_link_verify(token):
    token_record = pop_email_link_token(token)
    if not token_record:
        return render_auth_page(active_tab='login', login_status='验证链接已失效，请重新操作')

    payload = token_record.get('payload', {})
    purpose = payload.get('purpose')

    if purpose == 'oauth_bind':
        email = payload.get('email')
        binding_token = payload.get('binding_token')
        if not email or not binding_token:
            return render_auth_page(active_tab='login', login_status='邮箱绑定信息不完整')

        user, error, next_url, provider = _finalize_oauth_binding(binding_token, email)
        if error:
            return render_auth_page(active_tab='login', login_status=error)

        login_user(user)
        session['nickname'] = user.nickname
        session['oauth_provider'] = provider or 'oauth'
        return redirect(next_url or url_for('main.hello'))

    if purpose == 'register':
        email = payload.get('email')
        register_token = payload.get('register_token')
        if not email or not register_token:
            return render_auth_page(active_tab='login', login_status='注册信息不完整')

        pending = pop_pending_registration(register_token)
        if not pending:
            return render_auth_page(active_tab='login', login_status='注册链接已失效，请重新提交注册')

        register_payload = pending.get('payload', {})
        nickname = register_payload.get('nickname')
        password = register_payload.get('password')
        next_url = register_payload.get('next_url')
        if not nickname or not password:
            return render_auth_page(active_tab='login', login_status='注册信息不完整')

        with Database('./database.db') as db:
            if db.email_exists(email):
                return render_auth_page(active_tab='login', login_status='邮箱已被注册，请直接登录')
            if db.nickname_exists(nickname):
                return render_auth_page(active_tab='login', login_status='昵称已被注册，请更换昵称')

            db.insert(email, password, nickname, get_china_time())
            db.update_avatar(email, 'default_avatar.png')
            user_row = db.fetch(email)

        if not user_row:
            return render_auth_page(active_tab='login', login_status='注册失败，请稍后重试')

        user = User(user_row[0], user_row[1], user_row[2], user_row[5], user_row[3], user_row[4])
        login_user(user)
        session['nickname'] = user.nickname
        session['from_register'] = True
        return redirect(next_url or url_for('main.hello'))

    if purpose == 'update_email':
        current_email = payload.get('current_email')
        new_email = payload.get('new_email')
        if not current_email or not new_email:
            return render_auth_page(active_tab='login', login_status='邮箱验证信息不完整')

        with Database('./database.db') as db:
            if db.email_exists(new_email) and new_email != current_email:
                return render_auth_page(active_tab='login', login_status='该邮箱已被注册')
            if not db.update_email(current_email, new_email):
                return render_auth_page(active_tab='login', login_status='邮箱更新失败，请稍后重试')
            user_row = db.fetch(new_email)

        if current_user.is_authenticated and getattr(current_user, 'email', None) == current_email:
            current_user.email = new_email
            if user_row:
                current_user.nickname = user_row[1]
                current_user.password = user_row[2]
                current_user.register_time = user_row[5] if len(user_row) > 5 else current_user.register_time
                current_user.avatar = user_row[3] if len(user_row) > 3 and user_row[3] else current_user.avatar
                current_user.friend_link = user_row[4] if len(user_row) > 4 and user_row[4] else current_user.friend_link
            session['nickname'] = user_row[1] if user_row else session.get('nickname')
            return redirect(url_for('user.user_info'))

        return render_auth_page(active_tab='login', login_status='邮箱已验证并完成修改，请使用新邮箱登录')

    return render_auth_page(active_tab='login', login_status='未知的验证类型')