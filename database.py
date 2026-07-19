import sqlite3

class Database:
    def __init__(self,dbUrl):
        self.dbUrl = dbUrl
        self.conn = None
        self.cur = None
        self._connect()
        
    def _connect(self):
        try:
            # 设置连接参数以提高线程安全性
            self.conn = sqlite3.connect(
                self.dbUrl, 
                check_same_thread=False,
                timeout=10.0  # 10秒超时
            )
            self.cur = self.conn.cursor()
            self.cur.execute("CREATE TABLE IF NOT EXISTS users (email TEXT,nickname TEXT,password TEXT,avatar TEXT,friend_link TEXT,register_time TEXT)")
            self.cur.execute("CREATE TABLE IF NOT EXISTS messages (nickname TEXT,time TEXT,content TEXT,UNIQUE(nickname,time))")
            self.cur.execute("CREATE TABLE IF NOT EXISTS oc_introduces (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, order_id INTEGER, UNIQUE(title))")
            self.cur.execute("CREATE TABLE IF NOT EXISTS blogs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, created_time TEXT NOT NULL, updated_time TEXT, author_email TEXT NOT NULL, is_published INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0)")
            self.cur.execute("CREATE TABLE IF NOT EXISTS blog_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, tag_name TEXT NOT NULL UNIQUE, created_time TEXT NOT NULL)")
            self.cur.execute("CREATE TABLE IF NOT EXISTS blog_tag_relations (blog_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (blog_id, tag_id), FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE)")
            self.cur.execute("CREATE TABLE IF NOT EXISTS blog_likes (id INTEGER PRIMARY KEY AUTOINCREMENT, blog_id INTEGER NOT NULL, liker_email TEXT NOT NULL, UNIQUE(blog_id, liker_email), FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE)")
            self.cur.execute("CREATE TABLE IF NOT EXISTS blog_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, blog_id INTEGER NOT NULL, commenter_email TEXT NOT NULL, commenter_nickname TEXT NOT NULL, comment_content TEXT NOT NULL, comment_time TEXT NOT NULL, FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE)")
            self.cur.execute("CREATE TABLE IF NOT EXISTS oauth_accounts (provider TEXT NOT NULL, provider_user_id TEXT NOT NULL, email TEXT NOT NULL, display_name TEXT, avatar TEXT, profile_json TEXT, created_time TEXT, updated_time TEXT, PRIMARY KEY (provider, provider_user_id))")
            # 检查并升级现有的用户表，添加avatar列
            try:
                self.cur.execute("SELECT avatar FROM users LIMIT 1")
            except sqlite3.OperationalError:
                # avatar列不存在，添加它
                self.cur.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT 'default_avatar.png'")
                print("Added avatar column to users table")
            
            # 检查并升级现有的用户表，添加friend_link列
            try:
                self.cur.execute("SELECT friend_link FROM users LIMIT 1")
            except sqlite3.OperationalError:
                # friend_link列不存在，添加它
                self.cur.execute("ALTER TABLE users ADD COLUMN friend_link TEXT DEFAULT ''")
                print("Added friend_link column to users table")
                
            # 检查并升级现有的用户表，添加register_time列
            try:
                self.cur.execute("SELECT register_time FROM users LIMIT 1")
            except sqlite3.OperationalError:
                # register_time列不存在，添加它
                self.cur.execute("ALTER TABLE users ADD COLUMN register_time TEXT DEFAULT ''")
                print("Added register_time column to users table")
            self.conn.commit()
        except Exception as e:
            print(f"Database connection error: {e}")
            raise
            
    def insert(self,email,password,nickname,register_time=''):
        try:
            self.cur.execute("INSERT INTO users (email, nickname, password, avatar, friend_link, register_time) VALUES (?,?,?,?,?,?)",
                            (email, nickname, password, 'default_avatar.png', '', register_time))
            self.conn.commit()
        except Exception as e:
            print(f"Database insert error: {e}")
            self.conn.rollback()
            raise
            
    def fetch(self,account):
        try:
            self.cur.execute("SELECT * FROM users WHERE email=?",(account,))
            rows=self.cur.fetchall()
            if len(rows) == 1:  return rows[0]
            self.cur.execute("SELECT * FROM users WHERE nickname=?",(account,))
            rows=self.cur.fetchall()
            if len(rows) == 1:  return rows[0]
            return None
        except Exception as e:
            print(f"Database fetch error: {e}")
            return None
            
    def check(self,account,password):
        try:
            self.cur.execute("SELECT * FROM users WHERE email=? AND password=?",(account,password))
            rows=self.cur.fetchall()
            if len(rows) == 1:  return True
            self.cur.execute("SELECT * FROM users WHERE nickname=? AND password=?",(account,password))
            return len(self.cur.fetchall()) == 1
        except Exception as e:
            print(f"Database check error: {e}")
            return False
            
    def insert_message(self,nickname,time,content):
        try:
            self.cur.execute("INSERT INTO messages VALUES (?,?,?)",(nickname,time,content))
            self.conn.commit()
        except Exception as e:
            print(f"Database insert_message error: {e}")
            self.conn.rollback()
            raise
            
    def count_user_messages(self, nickname):
        try:
            self.cur.execute("SELECT COUNT(*) FROM messages WHERE nickname=?", (nickname,))
            result = self.cur.fetchone()
            return result[0] if result else 0
        except Exception as e:
            print(f"Database count_user_messages error: {e}")
            return 0
            
    def update_password(self, email, new_password):
        try:
            self.cur.execute("UPDATE users SET password=? WHERE email=?", (new_password, email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database update_password error: {e}")
            self.conn.rollback()
            return False
            
    def update_avatar(self, email, avatar_filename):
        try:
            self.cur.execute("UPDATE users SET avatar=? WHERE email=?", (avatar_filename, email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database update_avatar error: {e}")
            self.conn.rollback()
            return False
            
    def update_friend_link(self, email, friend_link):
        try:
            self.cur.execute("UPDATE users SET friend_link=? WHERE email=?", (friend_link, email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database update_friend_link error: {e}")
            self.conn.rollback()
            return False
            
    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception as e:
            print(f"Database close error: {e}")
            
    def __enter__(self):
        return self
        
    def fetch_friend_links(self, page=0, per_page=10):
        try:
            offset = page * per_page
            self.cur.execute("SELECT nickname, avatar, friend_link, email FROM users WHERE friend_link != '' AND friend_link IS NOT NULL LIMIT ? OFFSET ?", 
                            (per_page, offset))
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_friend_links error: {e}")
            return []
            
    def count_friend_links(self):
        try:
            self.cur.execute("SELECT COUNT(*) FROM users WHERE friend_link != '' AND friend_link IS NOT NULL")
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database count_friend_links error: {e}")
            return 0
    
    def insert_oc_introduce(self, title, content, order_id):
        try:
            self.cur.execute("INSERT OR REPLACE INTO oc_introduces (title, content, order_id) VALUES (?, ?, ?)",
                          (title, content, order_id))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database insert_oc_introduce error: {e}")
            self.conn.rollback()
            return False
            
    def fetch_oc_introduces(self):
        try:
            self.cur.execute("SELECT title, order_id FROM oc_introduces ORDER BY order_id")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_oc_introduces error: {e}")
            return []
            
    def fetch_oc_introduce_by_title(self, title):
        try:
            self.cur.execute("SELECT content FROM oc_introduces WHERE title=?", (title,))
            result = self.cur.fetchone()
            if result:
                return result[0]
            return None
        except Exception as e:
            print(f"Database fetch_oc_introduce_by_title error: {e}")
            return None
            
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        
    # 管理模块所需的方法
    def fetch_all_users(self):
        """获取所有用户信息"""
        try:
            self.cur.execute("SELECT email, nickname, avatar, friend_link FROM users")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_all_users error: {e}")
            return []
            
    def delete_user(self, email):
        """删除指定用户"""
        try:
            self.cur.execute("DELETE FROM users WHERE email=?", (email,))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database delete_user error: {e}")
            self.conn.rollback()
            return False
            
    def update_user_info(self, email, nickname):
        """更新用户信息"""
        try:
            self.cur.execute("UPDATE users SET nickname=? WHERE email=?", (nickname, email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database update_user_info error: {e}")
            self.conn.rollback()
            return False
            
    def fetch_all_messages(self):
        """获取所有留言"""
        try:
            # 为管理目的，我们需要一个唯一标识符，因此我们使用ROWID
            self.cur.execute("SELECT ROWID, nickname, time, content FROM messages ORDER BY time DESC")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_all_messages error: {e}")
            return []
            
    def delete_message(self, message_id):
        """删除指定留言"""
        try:
            self.cur.execute("DELETE FROM messages WHERE ROWID=?", (message_id,))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database delete_message error: {e}")
            self.conn.rollback()
            return False
            
    def count_users(self):
        """统计用户数量"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM users")
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database count_users error: {e}")
            return 0
            
    def count_messages(self):
        """统计留言数量"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM messages")
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database count_messages error: {e}")
            return 0
            
    def get_user_register_time(self, email):
        """获取用户注册时间"""
        try:
            self.cur.execute("SELECT register_time FROM users WHERE email=?", (email,))
            result = self.cur.fetchone()
            if result:
                return result[0]
            return '未记录'
        except Exception as e:
            print(f"Database get_user_register_time error: {e}")
            return '未记录'
            
    def update_nickname(self, email, nickname):
        """更新用户昵称"""
        try:
            self.cur.execute("UPDATE users SET nickname=? WHERE email=?", (nickname, email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database update_nickname error: {e}")
            self.conn.rollback()
            return False
            
    def update_email(self, old_email, new_email):
        """更新用户邮箱"""
        try:
            self.cur.execute("UPDATE users SET email=? WHERE email=?", (new_email, old_email))
            self.cur.execute("UPDATE oauth_accounts SET email=? WHERE email=?", (new_email, old_email))
            self.cur.execute("UPDATE blogs SET author_email=? WHERE author_email=?", (new_email, old_email))
            self.cur.execute("UPDATE blog_likes SET liker_email=? WHERE liker_email=?", (new_email, old_email))
            self.cur.execute("UPDATE blog_comments SET commenter_email=? WHERE commenter_email=?", (new_email, old_email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database update_email error: {e}")
            self.conn.rollback()
            return False
            
    def email_exists(self, email):
        """检查邮箱是否存在"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM users WHERE email=?", (email,))
            return self.cur.fetchone()[0] > 0
        except Exception as e:
            print(f"Database email_exists error: {e}")
            return False

    def fetch_oauth_account(self, provider, provider_user_id):
        """获取已绑定的第三方账号"""
        try:
            self.cur.execute(
                "SELECT provider, provider_user_id, email, display_name, avatar, profile_json, created_time, updated_time FROM oauth_accounts WHERE provider=? AND provider_user_id=?",
                (provider, provider_user_id),
            )
            return self.cur.fetchone()
        except Exception as e:
            print(f"Database fetch_oauth_account error: {e}")
            return None

    def upsert_oauth_account(self, provider, provider_user_id, email, display_name='', avatar='', profile_json=''):
        """绑定或更新第三方账号与站内邮箱"""
        try:
            from app.utils import get_china_time

            existing = self.fetch_oauth_account(provider, provider_user_id)
            if existing:
                self.cur.execute(
                    "UPDATE oauth_accounts SET email=?, display_name=?, avatar=?, profile_json=?, updated_time=? WHERE provider=? AND provider_user_id=?",
                    (email, display_name, avatar, profile_json, get_china_time(), provider, provider_user_id),
                )
            else:
                self.cur.execute(
                    "INSERT INTO oauth_accounts (provider, provider_user_id, email, display_name, avatar, profile_json, created_time, updated_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (provider, provider_user_id, email, display_name, avatar, profile_json, get_china_time(), get_china_time()),
                )
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database upsert_oauth_account error: {e}")
            self.conn.rollback()
            return False
            
    def nickname_exists(self, nickname, exclude_email=None):
        """检查昵称是否存在，排除指定邮箱的用户"""
        try:
            if exclude_email:
                self.cur.execute("SELECT COUNT(*) FROM users WHERE nickname=? AND email!=?", (nickname, exclude_email))
            else:
                self.cur.execute("SELECT COUNT(*) FROM users WHERE nickname=?", (nickname,))
            return self.cur.fetchone()[0] > 0
        except Exception as e:
            print(f"Database nickname_exists error: {e}")
            
    # 博客相关方法
    def insert_blog(self, title, content, summary, created_time, author_email, is_published=0):
        """创建博客文章"""
        try:
            self.cur.execute("INSERT INTO blogs (title, content, summary, created_time, updated_time, author_email, is_published, view_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
                            (title, content, summary, created_time, created_time, author_email, is_published))
            self.conn.commit()
            return self.cur.lastrowid
        except Exception as e:
            print(f"Database insert_blog error: {e}")
            self.conn.rollback()
            return None
    
    def update_blog(self, blog_id, title, content, summary, updated_time):
        """更新博客文章"""
        try:
            self.cur.execute("UPDATE blogs SET title=?, content=?, summary=?, updated_time=? WHERE id=?",
                            (title, content, summary, updated_time, blog_id))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database update_blog error: {e}")
            self.conn.rollback()
            return False
    
    def delete_blog(self, blog_id):
        """删除博客文章"""
        try:
            self.cur.execute("DELETE FROM blogs WHERE id=?", (blog_id,))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database delete_blog error: {e}")
            self.conn.rollback()
            return False
    
    def fetch_blog_by_id(self, blog_id):
        """获取单篇博客文章"""
        try:
            self.cur.execute("SELECT id, title, content, summary, created_time, updated_time, author_email, is_published, view_count FROM blogs WHERE id=?", (blog_id,))
            return self.cur.fetchone()
        except Exception as e:
            print(f"Database fetch_blog_by_id error: {e}")
            return None
    
    def fetch_all_blogs(self, limit=None, offset=0):
        """获取所有博客文章（用于管理后台）"""
        try:
            if limit:
                self.cur.execute("SELECT id, title, summary, created_time, updated_time, is_published, view_count FROM blogs ORDER BY created_time DESC LIMIT ? OFFSET ?", 
                                (limit, offset))
            else:
                self.cur.execute("SELECT id, title, summary, created_time, updated_time, is_published, view_count FROM blogs ORDER BY created_time DESC")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_all_blogs error: {e}")
            return []
    
    def fetch_published_blogs(self, limit=None, offset=0):
        """获取已发布的博客文章（用于前台展示）"""
        try:
            if limit:
                self.cur.execute("SELECT id, title, summary, created_time, updated_time, view_count FROM blogs WHERE is_published=1 ORDER BY created_time DESC LIMIT ? OFFSET ?", 
                                (limit, offset))
            else:
                self.cur.execute("SELECT id, title, summary, created_time, updated_time, view_count FROM blogs WHERE is_published=1 ORDER BY created_time DESC")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_published_blogs error: {e}")
            return []
    
    def increment_view_count(self, blog_id):
        """增加博客阅读次数"""
        try:
            self.cur.execute("UPDATE blogs SET view_count = view_count + 1 WHERE id=?", (blog_id,))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database increment_view_count error: {e}")
            self.conn.rollback()
            return False
    
    def toggle_blog_publish(self, blog_id):
        """切换博客发布状态"""
        try:
            self.cur.execute("UPDATE blogs SET is_published = 1 - is_published WHERE id=?", (blog_id,))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database toggle_blog_publish error: {e}")
            self.conn.rollback()
            return False
    
    def count_blogs(self):
        """统计博客总数"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM blogs")
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database count_blogs error: {e}")
            return 0
    
    def count_published_blogs(self):
        """统计已发布博客数"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM blogs WHERE is_published=1")
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database count_published_blogs error: {e}")
            return 0
    
    # 博客标签相关方法
    def get_or_create_tag(self, tag_name):
        """获取或创建标签，返回tag_id"""
        try:
            tag_name = tag_name.strip()
            if not tag_name:
                return None
            
            # 先尝试获取
            self.cur.execute("SELECT id FROM blog_tags WHERE tag_name=?", (tag_name,))
            result = self.cur.fetchone()
            if result:
                return result[0]
            
            # 不存在则创建
            from datetime import datetime
            created_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            self.cur.execute("INSERT INTO blog_tags (tag_name, created_time) VALUES (?, ?)", (tag_name, created_time))
            self.conn.commit()
            return self.cur.lastrowid
        except Exception as e:
            print(f"Database get_or_create_tag error: {e}")
            self.conn.rollback()
            return None
    
    def fetch_all_tags(self):
        """获取所有标签"""
        try:
            self.cur.execute("SELECT id, tag_name FROM blog_tags ORDER BY tag_name")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_all_tags error: {e}")
            return []
    
    def fetch_blog_tags(self, blog_id):
        """获取指定博客的所有标签"""
        try:
            self.cur.execute("""
                SELECT bt.id, bt.tag_name 
                FROM blog_tags bt
                INNER JOIN blog_tag_relations btr ON bt.id = btr.tag_id
                WHERE btr.blog_id = ?
                ORDER BY bt.tag_name
            """, (blog_id,))
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_blog_tags error: {e}")
            return []
    
    def add_blog_tag(self, blog_id, tag_id):
        """为博客添加标签"""
        try:
            self.cur.execute("INSERT OR IGNORE INTO blog_tag_relations (blog_id, tag_id) VALUES (?, ?)", (blog_id, tag_id))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database add_blog_tag error: {e}")
            self.conn.rollback()
            return False
    
    def clear_blog_tags(self, blog_id):
        """清除博客的所有标签"""
        try:
            self.cur.execute("DELETE FROM blog_tag_relations WHERE blog_id=?", (blog_id,))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database clear_blog_tags error: {e}")
            self.conn.rollback()
            return False
    
    def set_blog_tags(self, blog_id, tag_names):
        """设置博客的标签（先清除再添加）"""
        try:
            # 清除现有标签
            self.clear_blog_tags(blog_id)
            
            # 添加新标签
            if tag_names:
                for tag_name in tag_names:
                    tag_id = self.get_or_create_tag(tag_name)
                    if tag_id:
                        self.add_blog_tag(blog_id, tag_id)
            
            return True
        except Exception as e:
            print(f"Database set_blog_tags error: {e}")
            return False

    # 博客点赞相关方法
    def add_blog_like(self, blog_id, liker_email):
        """添加博客点赞"""
        try:
            self.cur.execute("INSERT INTO blog_likes (blog_id, liker_email) VALUES (?, ?)", 
                            (blog_id, liker_email))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        except Exception as e:
            print(f"Database add_blog_like error: {e}")
            self.conn.rollback()
            return False

    def remove_blog_like(self, blog_id, liker_email):
        """移除博客点赞"""
        try:
            self.cur.execute("DELETE FROM blog_likes WHERE blog_id=? AND liker_email=?", 
                            (blog_id, liker_email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database remove_blog_like error: {e}")
            self.conn.rollback()
            return False

    def get_blog_likes_count(self, blog_id):
        """获取博客点赞数"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM blog_likes WHERE blog_id=?", (blog_id,))
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database get_blog_likes_count error: {e}")
            return 0

    def has_blog_liked(self, blog_id, liker_email):
        """检查用户是否已点赞博客"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM blog_likes WHERE blog_id=? AND liker_email=?", 
                            (blog_id, liker_email))
            return self.cur.fetchone()[0] > 0
        except Exception as e:
            print(f"Database has_blog_liked error: {e}")
            return False

    # 博客评论相关方法
    def add_blog_comment(self, blog_id, commenter_email, commenter_nickname, comment_content, comment_time):
        """添加博客评论"""
        try:
            self.cur.execute("INSERT INTO blog_comments (blog_id, commenter_email, commenter_nickname, comment_content, comment_time) VALUES (?, ?, ?, ?, ?)", 
                            (blog_id, commenter_email, commenter_nickname, comment_content, comment_time))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database add_blog_comment error: {e}")
            self.conn.rollback()
            return False

    def get_blog_comments(self, blog_id):
        """获取博客的所有评论"""
        try:
            self.cur.execute("SELECT commenter_nickname, comment_content, comment_time, commenter_email FROM blog_comments WHERE blog_id=? ORDER BY comment_time ASC", 
                            (blog_id,))
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database get_blog_comments error: {e}")
            return []

    def count_blog_comments(self, blog_id):
        """获取博客评论数"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM blog_comments WHERE blog_id=?", (blog_id,))
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database count_blog_comments error: {e}")
            return 0
