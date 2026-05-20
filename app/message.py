from flask import Blueprint, render_template, request, jsonify
from database import Database

message = Blueprint('message', __name__)

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
