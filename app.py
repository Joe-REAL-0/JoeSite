from flask import Flask,render_template,redirect,url_for,request,session
from flask import request, jsonify

from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_mail import Mail,Message

from random import choice
from time import time
import os,sqlite3
from datetime import datetime

class Database:
    def __init__(self,dbUrl):
        self.conn=sqlite3.connect(dbUrl)
        self.cur=self.conn.cursor()
        self.cur.execute("CREATE TABLE IF NOT EXISTS users (email TEXT,nickname TEXT,password TEXT)")
        self.cur.execute("CREATE TABLE IF NOT EXISTS messages (nickname TEXT,time TEXT,content TEXT,UNIQUE(nickname,time))")
        self.conn.commit()
    def insert(self,email,password,nickname):
        self.cur.execute("INSERT INTO users VALUES (?,?,?)",(email,nickname,password))
        self.conn.commit()
    def fetch(self,account):
        self.cur.execute("SELECT * FROM users WHERE email=?",(account,))
        rows=self.cur.fetchall()
        if len(rows) == 1:  return rows[0]
        self.cur.execute("SELECT * FROM users WHERE nickname=?",(account,))
        rows=self.cur.fetchall()
        if len(rows) == 1:  return rows[0]
        return None
    def check(self,account,password):
        self.cur.execute("SELECT * FROM users WHERE email=? AND password=?",(account,password))
        rows=self.cur.fetchall()
        if len(rows) == 1:  return True
        self.cur.execute("SELECT * FROM users WHERE nickname=? AND password=?",(account,password))
        return len(self.cur.fetchall()) == 1
    def insert_message(self,nickname,time,content):
        self.cur.execute("INSERT OR REPLACE INTO messages VALUES (?,?,?)",(nickname,time,content))
        self.conn.commit()
    def fetch_messages(self):
        self.cur.execute("SELECT * FROM messages")
        return self.cur.fetchall()
    def close(self):
        self.conn.close()

class User(UserMixin):
    def __init__(self,email,nickname,password):
        self.email=email
        self.nickname=nickname
        self.password=password
    def get_id(self):
        return self.email

legal_characters = ['A', 'B', 'C', 'D',
'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
]

app = Flask(__name__)
app.secret_key = 'ThisIsJoeSite'

app.config['MAIL_SERVER'] = 'smtp.qq.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = '2018168257@qq.com'
app.config['MAIL_PASSWORD'] = 'kbwfgfnvbqiobcbc'
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USE_TLS'] = False
mail=Mail(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(email):
    db=Database('./database.db')
    userData = db.fetch(email)
    db.close()
    if userData:
        return User(userData[0],userData[1],userData[2])
    return None

email_dict = {}
@app.before_request
def redirect_to_https():
    if request.url.startswith('http://'):
        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301)

@app.route('/')
def hello():
    if(session.get('nickname')):
        return render_template('index.html',nickname="欢迎你,"+session.get('nickname'),status="注销账号")
    return render_template('index.html')

@app.route('/oc_introduce')
def introduce():
    file_dir = os.path.join(app.static_folder, 'text', 'oc_introduce')
    sorted_list = sorted(os.listdir(file_dir))
    title_list = [file[2:][:-4] for file in sorted_list if file.endswith('.txt')]
    return render_template('oc_introduce.html',titleList=title_list)

@app.route('/self_diary')
@login_required
def diary():
    return render_template('diary.html')

@app.route('/message_wall')
def message():
    db=Database('./database.db')
    messages = db.fetch_messages()
    messages = [list(msg) for msg in messages]
    return render_template('message_wall.html',messages=messages)

@app.route('/note')
@login_required
def note():
    return render_template('note.html',nickname=session.get('nickname'))

@app.route('/login')
def login():
    if request.referrer and ('login' not in request.referrer or 'register' not in request.referrer):
        session['next'] = request.referrer
    else:
        session['next'] = url_for('hello')
    if (session.get('nickname')):
        logout_user()
        session.pop('nickname')
        return redirect(url_for('hello'))
    if (session.get('info')):
        info = session.get('info')
        session.pop('info')
        return render_template('login.html',info=info)
    return render_template('login.html',info=['',''])

@app.route('/register')
def register():
    return render_template('register.html',info=['','','',''])

@app.route('/login_checker', methods=['POST'])
def login_checker():
    account = request.form.get('account')
    password = request.form.get('password')
    info = [account,password]
    if account and password:
        db=Database('./database.db')
        userData = db.fetch(account)
        if(db.check(account,password)):
            user = User(userData[0],userData[1],userData[2])
            login_user(user)
            db.close()
            session['nickname'] = userData[1]
            return redirect(session.get('next') or url_for('hello'))
        else:
            db.close()
            return render_template('login.html', info=info, status="账号或密码错误")
    else:
        db.close()
        return render_template('login.html', info=info, status="请填写完整信息")

@app.route('/register_checker', methods=['POST'])
def register_checker():
    email = request.form.get('email')
    nickname = request.form.get('nickname')
    password = request.form.get('password')
    repeat_password = request.form.get('repeat_password')
    Info_list = [email,nickname,password,repeat_password]
    if (not email in email_dict):
        status="请先点击获取验证码"
    elif (email_dict[email][1]+300 < time()):
        status="验证码已过期，请重新获取"
    elif (email_dict[email][0]!=request.form.get('code')):
        status="验证码错误，请注意区分大小写"
    elif (len(nickname) >= 20):
        status="昵称长度需低于20个字符"
    elif password != repeat_password:
        status="两次输入的密码不一致"
    else:
        db=Database('./database.db')
        if db.fetch(email):
            status="邮箱已被注册"
        elif db.fetch(nickname):
            status="昵称已被注册"
        else:
            db.insert(email,password,nickname)
            db.close()
            email_dict.pop(email)
            session['info']=[nickname,password]
            return redirect(url_for('login'))
        db.close()
    return render_template('register.html',info=Info_list , status=status)

@app.route('/email_sender', methods=['POST'])
def send_email():
    email = request.get_json()['email']
    code = ''.join(choice(legal_characters) for _ in range(8))
    timestamp=time()
    email_dict[email]=[code,timestamp]
    try:
        msg = Message('来自Joe Site的验证邮件', sender='joe_real@qq.com', recipients=[email])
        msg.body = f"这是Joe从 www.furryjoe.site 发送的身份验证邮件\n如非您本人操作请忽略该消息\n\n*感谢你的来访！\n以下是你的验证码\n\n  {code}  \n\n请在 五分钟 内进行验证并完成注册"
        mail.send(msg)
        return jsonify({'message': '验证码已发送'})
    except Exception as e:
        print(e)
        return jsonify({'message': '验证码发送失败'})
    
@app.route('/note_store', methods=['POST'])
def note_store():
    db=Database('./database.db')
    current_time = datetime.now().strftime("%Y年%m月%d日 %H:%M")
    db.insert_message(session.get('nickname'),current_time,request.form.get('note'))
    db.close()
    return redirect(url_for('message'))

@app.route('/find_text', methods=['POST'])
def find_text():
    textType = request.get_json()['textType']
    title = request.get_json()['title']
    file_path = os.path.join(app.static_folder, 'text', textType , title + '.txt')
    if os.path.exists(file_path):
        with open(file_path, 'r',encoding='utf-8') as file:
            content = file.read()
        return jsonify({'text': content})
    else:
        return jsonify({'text': 'Text file not found'})

if __name__ == '__main__':
    app.run(host="0.0.0.0" ,port=30069)