from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timezone, timedelta
from database import Database

message = Blueprint('message', __name__)

@message.route('/message_wall')
def message_wall():
    try:
        with Database('./database.db') as db:
            # 获取所有留言
            messages = db.fetch_messages()
            messages = [list(msg) for msg in messages]
            
            # 添加点赞数和评论数
            for msg in messages:
                # 添加点赞数
                likes_count = db.get_likes_count(msg[0], msg[1])
                msg.append(likes_count)
                
                # 添加评论数
                comments = db.get_comments(msg[0], msg[1])
                msg.append(len(comments))
                
                # 添加当前用户是否点赞
                has_liked = False
                if current_user.is_authenticated:
                    has_liked = db.has_liked(msg[0], msg[1], current_user.email)
                msg.append(has_liked)
            
            # 提取唯一的用户
            unique_users = {}
            for msg in messages:
                if msg[0] not in unique_users:
                    # 获取用户头像
                    user_info = db.fetch(msg[0])
                    avatar = user_info[3] if user_info else 'default_avatar.png'
                    unique_users[msg[0]] = [msg[0], avatar]
            
            # 将唯一用户转换为列表
            users = list(unique_users.values())
            
            # 是否已登录
            is_logged_in = current_user.is_authenticated
            
            # 调试输出
            print("Messages data:", messages)
            print("Users data:", users)
            print("Is logged in:", is_logged_in)
            
            # 确保所有数据都是可序列化的
            messages_json_safe = []
            for msg in messages:
                # 确保布尔值正确转换
                msg_copy = list(msg)
                if len(msg_copy) > 5:
                    msg_copy[5] = bool(msg_copy[5])  # 确保是布尔值
                messages_json_safe.append(msg_copy)
            
            return render_template('message_wall.html', messages=messages_json_safe, users=users, is_logged_in=is_logged_in, current_user=current_user)
    except Exception as e:
        print(f"Error in message_wall: {e}")
        return render_template('message_wall.html', messages=[], users=[], is_logged_in=False, current_user=current_user)

@message.route('/friend_link')
def friend_link():
    try:
        page = request.args.get('page', 0, type=int)
        with Database('./database.db') as db:
            friend_links = db.fetch_friend_links(page=page)
            friend_links = [list(link) for link in friend_links]
            total_links = db.count_friend_links()
            has_more = (page + 1) * 10 < total_links
            return render_template('friend_link.html', friend_links=friend_links, 
                                  page=page, has_more=has_more)
    except Exception as e:
        print(f"Error in friend_link: {e}")
        return render_template('friend_link.html', friend_links=[], page=0, has_more=False)

@message.route('/api/friend_links')
def api_friend_links():
    try:
        page = request.args.get('page', 0, type=int)
        with Database('./database.db') as db:
            friend_links = db.fetch_friend_links(page=page)
            friend_links = [{"nickname": link[0], "avatar": link[1], "url": link[2]} for link in friend_links]
            total_links = db.count_friend_links()
            has_more = (page + 1) * 10 < total_links
            return jsonify({
                "friend_links": friend_links,
                "has_more": has_more
            })
    except Exception as e:
        print(f"Error in api_friend_links: {e}")
        return jsonify({"friend_links": [], "has_more": False})

@message.route('/note')
@login_required
def note():
    try:
        nickname = session.get('nickname')
        with Database('./database.db') as db:
            # 获取用户已发表的留言数量
            user_message_count = db.count_user_messages(nickname)
            return render_template('note.html', nickname=nickname, user_message_count=user_message_count)
    except Exception as e:
        print(f"Note page error: {e}")
        return render_template('note.html', nickname=session.get('nickname'), user_message_count=0)

@message.route('/note_store', methods=['POST'])
@login_required
def note_store():
    try:
        nickname = session.get('nickname')
        note_content = request.form.get('note', '').strip()
        
        # 检查留言是否为空
        if not note_content:
            return redirect(url_for('message.note'))
            
        with Database('./database.db') as db:
            # 检查用户留言是否已达上限
            user_message_count = db.count_user_messages(nickname)
            if user_message_count >= 5:
                return redirect(url_for('message.message_wall'))
            
            from app.utils import get_china_time
            # 获取东八区当前时间
            current_time = get_china_time("%Y年%m月%d日 %H:%M:%S")
            db.insert_message(nickname, current_time, note_content)
            return redirect(url_for('message.message_wall'))
    except Exception as e:
        print(f"Note store error: {e}")
        return redirect(url_for('message.message_wall'))
        
@message.route('/api/like_message', methods=['POST'])
@login_required
def like_message():
    """点赞或取消点赞留言"""
    try:
        data = request.get_json()
        message_nickname = data.get('message_nickname')
        message_time = data.get('message_time')
        user_email = current_user.email
        action = data.get('action', 'add')  # add or remove
        
        with Database('./database.db') as db:
            if action == 'add':
                success = db.add_like(message_nickname, message_time, user_email)
            else:
                success = db.remove_like(message_nickname, message_time, user_email)
            
            if success:
                # 获取最新点赞数
                likes_count = db.get_likes_count(message_nickname, message_time)
                return jsonify({"success": True, "count": likes_count})
            else:
                return jsonify({"success": False, "error": "操作失败"})
    except Exception as e:
        print(f"Like message error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
        
@message.route('/api/add_comment', methods=['POST'])
@login_required
def add_comment():
    """添加评论"""
    try:
        data = request.get_json()
        message_nickname = data.get('message_nickname')
        message_time = data.get('message_time')
        comment_content = data.get('content')
        
        if not comment_content or len(comment_content.strip()) == 0:
            return jsonify({"success": False, "error": "评论内容不能为空"})
            
        user_email = current_user.email
        user_nickname = current_user.nickname
        
        from app.utils import get_china_time
        comment_time = get_china_time("%Y-%m-%d %H:%M:%S")
        
        with Database('./database.db') as db:
            success = db.add_comment(message_nickname, message_time, user_email, user_nickname, comment_content, comment_time)
            
            if success:
                # 获取最新评论
                comments = db.get_comments(message_nickname, message_time)
                formatted_comments = []
                for comment in comments:
                    formatted_comments.append({
                        "nickname": comment[0],
                        "content": comment[1],
                        "time": comment[2],
                        "is_mine": comment[3] == user_email
                    })
                
                return jsonify({"success": True, "comments": formatted_comments})
            else:
                return jsonify({"success": False, "error": "添加评论失败"})
    except Exception as e:
        print(f"Add comment error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
        
@message.route('/api/get_message_data', methods=['GET'])
def get_message_data():
    """获取留言点赞和评论数据"""
    try:
        message_nickname = request.args.get('message_nickname')
        message_time = request.args.get('message_time')
        
        if not message_nickname or not message_time:
            return jsonify({"success": False, "error": "参数错误"})
            
        with Database('./database.db') as db:
            # 获取点赞数
            likes_count = db.get_likes_count(message_nickname, message_time)
            
            # 检查当前用户是否已点赞
            has_liked = False
            if current_user.is_authenticated:
                has_liked = db.has_liked(message_nickname, message_time, current_user.email)
            
            # 获取评论
            comments = db.get_comments(message_nickname, message_time)
            formatted_comments = []
            for comment in comments:
                is_mine = current_user.is_authenticated and comment[3] == current_user.email
                formatted_comments.append({
                    "nickname": comment[0],
                    "content": comment[1],
                    "time": comment[2],
                    "is_mine": is_mine
                })
            
            # 检查当前用户是否是该留言的作者（用于显示删除按钮）
            is_owner = current_user.is_authenticated and current_user.nickname == message_nickname
            
            return jsonify({
                "success": True, 
                "likes_count": likes_count,
                "has_liked": has_liked,
                "comments": formatted_comments,
                "is_owner": is_owner
            })
    except Exception as e:
        print(f"Get message data error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
        
@message.route('/api/delete_message', methods=['POST'])
@login_required
def delete_message():
    """删除留言"""
    try:
        data = request.get_json()
        message_nickname = data.get('message_nickname')
        message_time = data.get('message_time')
        
        if not message_nickname or not message_time:
            return jsonify({"success": False, "error": "参数错误"})
        
        # 安全检查：只允许删除自己的留言
        if current_user.nickname != message_nickname:
            return jsonify({"success": False, "error": "没有权限删除此留言"}), 403
            
        with Database('./database.db') as db:
            success = db.delete_message_by_nickname_time(message_nickname, message_time)
            
            if success:
                return jsonify({"success": True})
            else:
                return jsonify({"success": False, "error": "删除留言失败"})
    except Exception as e:
        print(f"Delete message error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500