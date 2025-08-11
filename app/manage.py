from flask import Blueprint, render_template, request, redirect, url_for, jsonify, session
from flask_login import login_required, current_user
from database import Database
from functools import wraps

manage = Blueprint('manage', __name__)

# 装饰器：检查当前用户是否是管理员账号
def admin_required(f):
    @wraps(f)
    @login_required  # 确保用户已经登录
    def decorated_function(*args, **kwargs):
        if current_user.email != "2018168257@qq.com":
            return redirect(url_for('main.hello'))
        return f(*args, **kwargs)
    return decorated_function

@manage.route('/manage')
@admin_required
def manage_page():
    """管理页面主入口"""
    try:
        with Database('./database.db') as db:
            users_count = db.count_users()
            messages_count = db.count_messages()
            
        return render_template('manage.html', 
                               users_count=users_count,
                               messages_count=messages_count)
    except Exception as e:
        print(f"Error in manage page: {e}")
        return render_template('manage.html', 
                               users_count=0,
                               messages_count=0)

@manage.route('/api/users', methods=['GET'])
@admin_required
def get_users():
    """获取所有用户列表"""
    try:
        with Database('./database.db') as db:
            users = db.fetch_all_users()
            users_list = [{"email": user[0], "nickname": user[1], "avatar": user[2], "friend_link": user[3]} 
                        for user in users]
            
        return jsonify({"success": True, "users": users_list})
    except Exception as e:
        print(f"Error getting users: {e}")
        return jsonify({"success": False, "message": str(e)})

@manage.route('/api/user/<email>', methods=['PUT', 'DELETE'])
@admin_required
def update_or_delete_user(email):
    """更新或删除用户信息"""
    try:
        if request.method == 'DELETE':
            with Database('./database.db') as db:
                success = db.delete_user(email)
            return jsonify({"success": success})
        
        elif request.method == 'PUT':
            data = request.get_json()
            nickname = data.get('nickname')
            
            with Database('./database.db') as db:
                success = db.update_user_info(email, nickname)
            
            return jsonify({"success": success})
    except Exception as e:
        print(f"Error updating/deleting user: {e}")
        return jsonify({"success": False, "message": str(e)})

@manage.route('/api/messages', methods=['GET'])
@admin_required
def get_messages():
    """获取所有留言"""
    try:
        with Database('./database.db') as db:
            messages = db.fetch_all_messages()
            messages_list = [{"id": msg[0], "nickname": msg[1], "time": msg[2], "content": msg[3]} 
                           for msg in messages]
            
        return jsonify({"success": True, "messages": messages_list})
    except Exception as e:
        print(f"Error getting messages: {e}")
        return jsonify({"success": False, "message": str(e)})

@manage.route('/api/messages/<int:message_id>', methods=['DELETE'])
@admin_required
def delete_message(message_id):
    """删除留言"""
    try:
        with Database('./database.db') as db:
            success = db.delete_message(message_id)
        
        return jsonify({"success": success})
    except Exception as e:
        print(f"Error deleting message: {e}")
        return jsonify({"success": False, "message": str(e)})

@manage.route('/api/user_messages/<nickname>', methods=['GET'])
@admin_required
def get_user_messages(nickname):
    """获取指定用户的所有留言"""
    try:
        with Database('./database.db') as db:
            # 执行SQL查询获取指定用户的留言
            db.cur.execute("SELECT ROWID, nickname, time, content FROM messages WHERE nickname=? ORDER BY time DESC", (nickname,))
            user_messages = db.cur.fetchall()
            
            messages_list = [{"id": msg[0], "nickname": msg[1], "time": msg[2], "content": msg[3]} 
                           for msg in user_messages]
            
        return jsonify({"success": True, "messages": messages_list})
    except Exception as e:
        print(f"Error getting user messages: {e}")
        return jsonify({"success": False, "message": str(e)})

@manage.route('/api/oc_introduces', methods=['GET', 'POST'])
@admin_required
def manage_oc_introduces():
    """获取或添加OC档案条目"""
    try:
        if request.method == 'GET':
            with Database('./database.db') as db:
                db.cur.execute("SELECT id, title, content, order_id FROM oc_introduces ORDER BY order_id")
                oc_list = db.cur.fetchall()
                oc_introduces = [{"id": oc[0], "title": oc[1], "content": oc[2], "order_id": oc[3]} for oc in oc_list]
                
            return jsonify({"success": True, "oc_introduces": oc_introduces})
            
        elif request.method == 'POST':
            data = request.get_json()
            title = data.get('title')
            content = data.get('content')
            order_id = data.get('order_id')
            
            with Database('./database.db') as db:
                success = db.insert_oc_introduce(title, content, order_id)
                
            return jsonify({"success": success})
    except Exception as e:
        print(f"Error managing OC introduces: {e}")
        return jsonify({"success": False, "message": str(e)})

@manage.route('/api/oc_introduces/<int:oc_id>', methods=['PUT', 'DELETE'])
@admin_required
def update_or_delete_oc(oc_id):
    """更新或删除OC档案条目"""
    try:
        if request.method == 'DELETE':
            with Database('./database.db') as db:
                db.cur.execute("DELETE FROM oc_introduces WHERE id=?", (oc_id,))
                db.conn.commit()
                success = True
                
            return jsonify({"success": success})
            
        elif request.method == 'PUT':
            data = request.get_json()
            title = data.get('title')
            content = data.get('content')
            order_id = data.get('order_id')
            
            with Database('./database.db') as db:
                db.cur.execute("UPDATE oc_introduces SET title=?, content=?, order_id=? WHERE id=?", 
                              (title, content, order_id, oc_id))
                db.conn.commit()
                success = True
                
            return jsonify({"success": success})
    except Exception as e:
        print(f"Error updating/deleting OC introduce: {e}")
        return jsonify({"success": False, "message": str(e)})
