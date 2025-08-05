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
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
