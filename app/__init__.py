from flask import Flask
from flask_login import LoginManager
from flask_mail import Mail
import os
from dotenv import load_dotenv

from app.auth import auth as auth_blueprint
from app.oauth import oauth as oauth_blueprint
from app.main import main as main_blueprint
from app.user import user as user_blueprint
from app.message import message as message_blueprint
from app.manage import manage as manage_blueprint
from app.blog import blog as blog_blueprint
from app.seo import seo as seo_blueprint

from app.auth import email_dict, legal_characters
from app.auth import User, load_user

load_dotenv()

app = Flask(__name__, template_folder='../templates', static_folder='../static')
app.secret_key = 'ThisIsJoeSite'

# 配置上传文件路径和允许的扩展

app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static', 'images', 'avatars')
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}

# 配置邮件服务
app.config['MAIL_SERVER'] = 'smtp.qq.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USE_TLS'] = False

# GitHub OAuth 配置
app.config['GITHUB_CLIENT_ID'] = os.getenv('GITHUB_CLIENT_ID')
app.config['GITHUB_CLIENT_SECRET'] = os.getenv('GITHUB_CLIENT_SECRET')
app.config['GITHUB_REDIRECT_URI'] = os.getenv('GITHUB_REDIRECT_URI')

app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET')
app.config['GOOGLE_REDIRECT_URI'] = os.getenv('GOOGLE_REDIRECT_URI')

app.config['DISCORD_CLIENT_ID'] = os.getenv('DISCORD_CLIENT_ID')
app.config['DISCORD_CLIENT_SECRET'] = os.getenv('DISCORD_CLIENT_SECRET')
app.config['DISCORD_REDIRECT_URI'] = os.getenv('DISCORD_REDIRECT_URI')

app.config['TELEGRAM_BOT_TOKEN'] = os.getenv('TELEGRAM_BOT_TOKEN')
app.config['TELEGRAM_BOT_USERNAME'] = os.getenv('TELEGRAM_BOT_USERNAME')
app.config['TELEGRAM_REDIRECT_URI'] = os.getenv('TELEGRAM_REDIRECT_URI')

mail = Mail(app)

# 初始化登录管理器
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

app.register_blueprint(auth_blueprint)
app.register_blueprint(oauth_blueprint)
app.register_blueprint(main_blueprint)
app.register_blueprint(user_blueprint)
app.register_blueprint(message_blueprint)
app.register_blueprint(manage_blueprint)
app.register_blueprint(blog_blueprint)
app.register_blueprint(seo_blueprint)

# 设置用户加载函数
login_manager.user_loader(load_user)

