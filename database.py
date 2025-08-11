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
            self.cur.execute("CREATE TABLE IF NOT EXISTS users (email TEXT,nickname TEXT,password TEXT,avatar TEXT,friend_link TEXT)")
            self.cur.execute("CREATE TABLE IF NOT EXISTS messages (nickname TEXT,time TEXT,content TEXT,UNIQUE(nickname,time))")
            self.cur.execute("CREATE TABLE IF NOT EXISTS oc_introduces (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, order_id INTEGER, UNIQUE(title))")
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
            self.conn.commit()
        except Exception as e:
            print(f"Database connection error: {e}")
            raise
            
    def insert(self,email,password,nickname):
        try:
            self.cur.execute("INSERT INTO users (email, nickname, password, avatar, friend_link) VALUES (?,?,?,?,?)",
                            (email, nickname, password, 'default_avatar.png', ''))
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
            self.cur.execute("INSERT OR REPLACE INTO messages VALUES (?,?,?)",(nickname,time,content))
            self.conn.commit()
        except Exception as e:
            print(f"Database insert_message error: {e}")
            self.conn.rollback()
            raise
            
    def fetch_messages(self):
        try:
            self.cur.execute("SELECT * FROM messages")
            return self.cur.fetchall()
        except Exception as e:
            print(f"Database fetch_messages error: {e}")
            return []
            
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
