from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from flask_login import login_required
from datetime import datetime, timezone, timedelta
from database import Database

message = Blueprint('message', __name__)

@message.route('/message_wall')
def message_wall():
    try:
        with Database('./database.db') as db:
            messages = db.fetch_messages()
            messages = [list(msg) for msg in messages]
            return render_template('message_wall.html', messages=messages)
    except Exception as e:
        print(f"Error in message_wall: {e}")
        return render_template('message_wall.html', messages=[])

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

@message.route('/note_store', methods=['POST'])
@login_required
def note_store():
    try:
        with Database('./database.db') as db:
            # 创建东八区时区对象（UTC+8）
            china_timezone = timezone(timedelta(hours=8))
            # 获取东八区当前时间
            current_time = datetime.now(china_timezone).strftime("%Y年%m月%d日 %H:%M")
            db.insert_message(session.get('nickname'), current_time, request.form.get('note'))
            return redirect(url_for('message.message_wall'))
    except Exception as e:
        print(f"Note store error: {e}")
        return redirect(url_for('message.message_wall'))