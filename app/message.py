import os
from flask import Blueprint, render_template, request, jsonify, current_app
from database import Database

message = Blueprint('message', __name__)

@message.route('/friend_link')
def friend_link():
    try:
        page = request.args.get('page', 0, type=int)
        with Database('./database.db') as db:
            raw_links = db.fetch_friend_links(page=page)
            friend_links = []
            for link in raw_links:
                nickname, avatar, url, email = link
                avatar_path = os.path.join(current_app.config['UPLOAD_FOLDER'], avatar)
                if not os.path.exists(avatar_path):
                    avatar = 'default_avatar.png'
                    db.update_avatar(email, avatar)
                friend_links.append([nickname, avatar, url])
                
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
            raw_links = db.fetch_friend_links(page=page)
            friend_links = []
            for link in raw_links:
                nickname, avatar, url, email = link
                avatar_path = os.path.join(current_app.config['UPLOAD_FOLDER'], avatar)
                if not os.path.exists(avatar_path):
                    avatar = 'default_avatar.png'
                    db.update_avatar(email, avatar)
                friend_links.append({"nickname": nickname, "avatar": avatar, "url": url})
                
            total_links = db.count_friend_links()
            has_more = (page + 1) * 10 < total_links
            return jsonify({
                "friend_links": friend_links,
                "has_more": has_more
            })
    except Exception as e:
        print(f"Error in api_friend_links: {e}")
        return jsonify({"friend_links": [], "has_more": False})
