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
            self.cur.execute("CREATE TABLE IF NOT EXISTS message_likes (id INTEGER PRIMARY KEY AUTOINCREMENT, message_nickname TEXT, message_time TEXT, liker_email TEXT, UNIQUE(message_nickname, message_time, liker_email))")
            self.cur.execute("CREATE TABLE IF NOT EXISTS message_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, message_nickname TEXT, message_time TEXT, commenter_email TEXT, commenter_nickname TEXT, comment_content TEXT, comment_time TEXT)")
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
            
    def fetch_messages(self, limit=None, offset=0):
        try:
            if limit:
                self.cur.execute("SELECT * FROM messages ORDER BY time DESC LIMIT ? OFFSET ?", (limit, offset))
            else:
                self.cur.execute("SELECT * FROM messages ORDER BY time DESC")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_messages error: {e}")
            return []
            
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
            self.cur.execute("SELECT nickname, avatar, friend_link FROM users WHERE friend_link != '' AND friend_link IS NOT NULL LIMIT ? OFFSET ?", 
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
            
    def add_like(self, message_nickname, message_time, liker_email):
        """添加点赞"""
        try:
            self.cur.execute("INSERT INTO message_likes (message_nickname, message_time, liker_email) VALUES (?, ?, ?)", 
                            (message_nickname, message_time, liker_email))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            # 已经点赞过了
            return False
        except Exception as e:
            print(f"Database add_like error: {e}")
            self.conn.rollback()
            return False
            
    def remove_like(self, message_nickname, message_time, liker_email):
        """移除点赞"""
        try:
            self.cur.execute("DELETE FROM message_likes WHERE message_nickname=? AND message_time=? AND liker_email=?", 
                            (message_nickname, message_time, liker_email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database remove_like error: {e}")
            self.conn.rollback()
            return False
            
    def get_likes_count(self, message_nickname, message_time):
        """获取留言点赞数"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM message_likes WHERE message_nickname=? AND message_time=?", 
                            (message_nickname, message_time))
            return self.cur.fetchone()[0]
        except Exception as e:
            print(f"Database get_likes_count error: {e}")
            return 0
            
    def has_liked(self, message_nickname, message_time, liker_email):
        """检查用户是否已点赞"""
        try:
            self.cur.execute("SELECT COUNT(*) FROM message_likes WHERE message_nickname=? AND message_time=? AND liker_email=?", 
                            (message_nickname, message_time, liker_email))
            return self.cur.fetchone()[0] > 0
        except Exception as e:
            print(f"Database has_liked error: {e}")
            return False
            
    def add_comment(self, message_nickname, message_time, commenter_email, commenter_nickname, comment_content, comment_time):
        """添加评论，如果用户已经评论过则更新评论"""
        try:
            # 检查用户是否已经评论过这条留言
            self.cur.execute("SELECT id FROM message_comments WHERE message_nickname=? AND message_time=? AND commenter_email=?", 
                           (message_nickname, message_time, commenter_email))
            existing_comment = self.cur.fetchone()
            
            if existing_comment:
                # 如果已经评论过，更新评论内容和时间
                self.cur.execute("UPDATE message_comments SET comment_content=?, comment_time=? WHERE id=?",
                               (comment_content, comment_time, existing_comment[0]))
            else:
                # 如果没有评论过，插入新评论
                self.cur.execute("INSERT INTO message_comments (message_nickname, message_time, commenter_email, commenter_nickname, comment_content, comment_time) VALUES (?, ?, ?, ?, ?, ?)", 
                                (message_nickname, message_time, commenter_email, commenter_nickname, comment_content, comment_time))
            
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database add_comment error: {e}")
            self.conn.rollback()
            return False
            
    def get_comments(self, message_nickname, message_time):
        """获取留言的所有评论"""
        try:
            self.cur.execute("SELECT commenter_nickname, comment_content, comment_time, commenter_email FROM message_comments WHERE message_nickname=? AND message_time=? ORDER BY comment_time ASC", 
                            (message_nickname, message_time))
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database get_comments error: {e}")
            return []
            
    def delete_message_by_nickname_time(self, nickname, time):
        """删除指定用户的指定时间的留言"""
        try:
            # 首先删除相关的点赞记录
            self.cur.execute("DELETE FROM message_likes WHERE message_nickname=? AND message_time=?", (nickname, time))
            
            # 然后删除相关的评论记录
            self.cur.execute("DELETE FROM message_comments WHERE message_nickname=? AND message_time=?", (nickname, time))
            
            # 最后删除留言本身
            self.cur.execute("DELETE FROM messages WHERE nickname=? AND time=?", (nickname, time))
            
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database delete_message_by_nickname_time error: {e}")
            self.conn.rollback()
            return False
