from flask import Blueprint, render_template, request, jsonify, session
from flask_login import current_user, login_required, logout_user
import os
from database import Database

main = Blueprint('main', __name__)

@main.route('/')
def hello():
    if(session.get('nickname')):
        return render_template('index.html',
                               nickname="欢迎你,"+session.get('nickname'),
                               status="注销账号",
                               signature="")
    return render_template('index.html')

@main.route('/oc_introduce')
def introduce():
    try:
        with Database('./database.db') as db:
            oc_introduces = db.fetch_oc_introduces()
            title_list = [entry[0] for entry in oc_introduces] if oc_introduces else []
        
        # If no data in DB, fallback to file-based approach
        if not title_list:
            from app import app
            file_dir = os.path.join(app.static_folder, 'text', 'oc_introduce')
            sorted_list = sorted(os.listdir(file_dir))
            title_list = [file[2:][:-4] for file in sorted_list if file.endswith('.txt')]
            
            # Migrate files to database
            with Database('./database.db') as db:
                for i, title in enumerate(title_list):
                    file_path = os.path.join(file_dir, f"{i+1} {title}.txt")
                    if os.path.exists(file_path):
                        with open(file_path, 'r', encoding='utf-8') as file:
                            content = file.read()
                        db.insert_oc_introduce(title, content, i+1)
                        
        return render_template('oc_introduce.html', titleList=title_list)
    except Exception as e:
        print(f"Error in oc_introduce: {e}")
        return render_template('oc_introduce.html', titleList=[])

@main.route('/get_resources')
def get_resources():
    from app import app
    resources = []
    # Get all image files
    image_dir = os.path.join(app.static_folder, 'images')
    for root, dirs, files in os.walk(image_dir):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.ico')):
                # Get relative path from static folder
                rel_path = os.path.relpath(os.path.join(root, file), app.static_folder)
                resources.append(rel_path.replace('\\', '/'))  # Convert Windows path to URL path
    
    # Get all font files
    font_dir = os.path.join(app.static_folder, 'font')
    for root, dirs, files in os.walk(font_dir):
        for file in files:
            if file.lower().endswith(('.ttf', '.woff', '.woff2')):
                # Get relative path from static folder
                rel_path = os.path.relpath(os.path.join(root, file), app.static_folder)
                resources.append(rel_path.replace('\\', '/'))  # Convert Windows path to URL path
    
    return jsonify(resources)

@main.route('/self_diary')
def diary():
    return render_template('diary.html')

@main.route('/note')
@login_required
def note():
    db = Database('./database.db')
    nickname = session.get('nickname')
    return render_template('note.html', nickname=nickname, user_message_count=db.count_user_messages(nickname))

@main.route('/find_text', methods=['POST'])
def find_text():
    try:
        textType = request.get_json()['textType']
        title = request.get_json()['title']
        
        # For OC introduces, read from the database
        if textType == 'oc_introduce':
            # Extract just the title part from the format "1 Title"
            title_parts = title.split(' ', 1)
            if len(title_parts) > 1:
                clean_title = title_parts[1]
            else:
                clean_title = title
                
            with Database('./database.db') as db:
                content = db.fetch_oc_introduce_by_title(clean_title)
                if content:
                    return jsonify({'text': content})
        
        # Fallback to file-based approach for other text types or if DB lookup failed
        from app import app
        file_path = os.path.join(app.static_folder, 'text', textType, title + '.txt')
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            return jsonify({'text': content})
        else:
            return jsonify({'text': 'Text file not found'})
    except Exception as e:
        print(f"Find text error: {e}")
        return jsonify({'text': 'Error reading file'}), 500