from flask import Blueprint, render_template, request, redirect, url_for, jsonify, session, flash
from flask_login import login_required, current_user
from app.utils import get_china_time
from database import Database
from functools import wraps
import os
from datetime import datetime
import re

blog = Blueprint('blog', __name__)

# 装饰器：检查当前用户是否是管理员账号
def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        from dotenv import load_dotenv
        load_dotenv()
        if current_user.email != os.getenv('ADMIN_EMAIL'):
            return redirect(url_for('main.hello'))
        return f(*args, **kwargs)
    return decorated_function

def clean_markdown_for_summary(content):
    """
    清理Markdown标记，生成纯文本摘要
    移除 #、*、`、[]()、等Markdown语法标记
    """
    if not content:
        return ""
    
    text = content
    # 移除代码块
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`]*`', '', text)
    # 移除链接，保留链接文本
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # 移除图片
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)
    # 移除标题标记 #
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # 移除加粗和斜体标记 ** 和 *
    text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^\*]+)\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    # 移除列表标记
    text = re.sub(r'^[\s]*[-\*\+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[\s]*\d+\.\s+', '', text, flags=re.MULTILINE)
    # 移除引用标记
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    # 移除水平线
    text = re.sub(r'^[\s]*[-\*_]{3,}[\s]*$', '', text, flags=re.MULTILINE)
    # 移除多余空行
    text = re.sub(r'\n\s*\n', '\n', text)
    # 移除首尾空白
    text = text.strip()
    
    return text

@blog.route('/blog')
def blog_list():
    """博客列表页（前台访客查看）"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        offset = (page - 1) * per_page
        
        with Database('./database.db') as db:
            blogs = db.fetch_published_blogs(limit=per_page, offset=offset)
            total_count = db.count_published_blogs()
            
            # 为每个博客获取标签
            blogs_with_tags = []
            for blog in blogs:
                blog_id = blog[0]
                tags = db.fetch_blog_tags(blog_id)
                tag_names = [tag[1] for tag in tags]
                likes_count = db.get_blog_likes_count(blog_id)
                comments_count = db.count_blog_comments(blog_id)
                blogs_with_tags.append(blog + (tag_names, likes_count, comments_count))
        
        total_pages = (total_count + per_page - 1) // per_page
        
        return render_template('blog.html', 
                               blogs=blogs_with_tags,
                               page=page,
                               total_pages=total_pages,
                               total_count=total_count)
    except Exception as e:
        print(f"Error in blog_list: {e}")
        return render_template('blog.html', blogs=[], page=1, total_pages=0, total_count=0)

@blog.route('/blog/<int:blog_id>')
def blog_detail(blog_id):
    """博客详情页"""
    try:
        with Database('./database.db') as db:
            blog_data = db.fetch_blog_by_id(blog_id)
            
            if not blog_data:
                return "博客不存在", 404
            
            # 检查是否已发布（管理员可以查看未发布的）
            is_admin = False
            if current_user.is_authenticated:
                from dotenv import load_dotenv
                load_dotenv()
                is_admin = current_user.email == os.getenv('ADMIN_EMAIL')
            
            if not blog_data[7] and not is_admin:  # is_published
                return "博客不存在", 404
            
            # 增加阅读次数
            db.increment_view_count(blog_id)
            
            # 获取标签
            tags = db.fetch_blog_tags(blog_id)
            tag_names = [tag[1] for tag in tags]
            
            # 渲染Markdown
            from app.utils import render_markdown
            rendered_content = render_markdown(blog_data[2])
            
            blog_info = {
                'id': blog_data[0],
                'title': blog_data[1],
                'content': rendered_content,
                'summary': blog_data[3],
                'created_time': blog_data[4],
                'updated_time': blog_data[5],
                'author_email': blog_data[6],
                'is_published': blog_data[7],
                'view_count': blog_data[8] + 1,
                'tags': tag_names
            }
            
            # 获取点赞和评论数据
            likes_count = db.get_blog_likes_count(blog_id)
            comments_count = db.count_blog_comments(blog_id)
            has_liked = False
            if current_user.is_authenticated:
                has_liked = db.has_blog_liked(blog_id, current_user.email)
            
        is_logged_in = current_user.is_authenticated
        current_nickname = current_user.nickname if is_logged_in else ''
        login_url = url_for('auth.login')
        
        return render_template('blog_detail.html', blog=blog_info, is_admin=is_admin, 
                               is_logged_in=is_logged_in, current_nickname=current_nickname,
                               login_url=login_url, likes_count=likes_count, 
                               comments_count=comments_count, has_liked=has_liked)
    except Exception as e:
        print(f"Error in blog_detail: {e}")
        return f"加载博客时出错: {str(e)}", 500

@blog.route('/blog/write')
@admin_required
def blog_write():
    """写博客页面"""
    return render_template('blog_edit.html', blog=None, mode='create')

@blog.route('/blog/edit/<int:blog_id>')
@admin_required
def blog_edit(blog_id):
    """编辑博客页面"""
    try:
        with Database('./database.db') as db:
            blog_data = db.fetch_blog_by_id(blog_id)
            
            if not blog_data:
                return "博客不存在", 404
            
            # 获取标签
            tags = db.fetch_blog_tags(blog_id)
            tag_names = [tag[1] for tag in tags]
            
            blog_info = {
                'id': blog_data[0],
                'title': blog_data[1],
                'content': blog_data[2],
                'summary': blog_data[3],
                'created_time': blog_data[4],
                'updated_time': blog_data[5],
                'author_email': blog_data[6],
                'is_published': blog_data[7],
                'view_count': blog_data[8],
                'tags': tag_names
            }
            
        return render_template('blog_edit.html', blog=blog_info, mode='edit')
    except Exception as e:
        print(f"Error in blog_edit: {e}")
        return f"加载博客时出错: {str(e)}", 500

@blog.route('/blog/create', methods=['POST'])
@admin_required
def blog_create():
    """创建博客文章API"""
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        is_published = data.get('is_published', 0)
        tags = data.get('tags', [])  # 获取标签列表
        
        if not title or not content:
            return jsonify({"success": False, "message": "标题和内容不能为空"}), 400
        
        # 自动生成摘要：清理Markdown标记后提取内容
        clean_content = clean_markdown_for_summary(content)
        lines = clean_content.split('\n')
        summary_lines = [line.strip() for line in lines if line.strip()]
        summary = ' '.join(summary_lines)[:500]  # 限制长度为500字符，适合卡片显示
        
        created_time = get_china_time()
        
        with Database('./database.db') as db:
            blog_id = db.insert_blog(title, content, summary, created_time, current_user.email, is_published)
            
            if blog_id:
                # 保存标签
                if tags and isinstance(tags, list):
                    db.set_blog_tags(blog_id, tags)
                
                return jsonify({"success": True, "message": "博客创建成功", "blog_id": blog_id})
            else:
                return jsonify({"success": False, "message": "创建失败"}), 500
    except Exception as e:
        print(f"Error in blog_create: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@blog.route('/blog/update/<int:blog_id>', methods=['POST'])
@admin_required
def blog_update(blog_id):
    """更新博客文章API"""
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        tags = data.get('tags', [])  # 获取标签列表
        
        if not title or not content:
            return jsonify({"success": False, "message": "标题和内容不能为空"}), 400
        
        # 自动生成摘要：清理Markdown标记后提取内容
        clean_content = clean_markdown_for_summary(content)
        lines = clean_content.split('\n')
        summary_lines = [line.strip() for line in lines if line.strip()]
        summary = ' '.join(summary_lines)[:500]  # 限制长度为500字符，适合卡片显示
        
        updated_time = get_china_time()
        
        with Database('./database.db') as db:
            success = db.update_blog(blog_id, title, content, summary, updated_time)
            
            if success:
                # 更新标签
                if isinstance(tags, list):
                    db.set_blog_tags(blog_id, tags)
                
                return jsonify({"success": True, "message": "博客更新成功"})
            else:
                return jsonify({"success": False, "message": "更新失败"}), 500
    except Exception as e:
        print(f"Error in blog_update: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@blog.route('/blog/delete/<int:blog_id>', methods=['POST', 'DELETE'])
@admin_required
def blog_delete(blog_id):
    """删除博客文章API"""
    try:
        with Database('./database.db') as db:
            success = db.delete_blog(blog_id)
            
            if success:
                return jsonify({"success": True, "message": "博客删除成功"})
            else:
                return jsonify({"success": False, "message": "删除失败"}), 500
    except Exception as e:
        print(f"Error in blog_delete: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@blog.route('/blog/publish/<int:blog_id>', methods=['POST'])
@admin_required
def blog_publish(blog_id):
    """切换博客发布状态API"""
    try:
        with Database('./database.db') as db:
            success = db.toggle_blog_publish(blog_id)
            
            if success:
                return jsonify({"success": True, "message": "状态切换成功"})
            else:
                return jsonify({"success": False, "message": "操作失败"}), 500
    except Exception as e:
        print(f"Error in blog_publish: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@blog.route('/blog/manage')
@admin_required
def blog_manage():
    """博客管理页面（显示所有博客包括草稿）"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 20
        offset = (page - 1) * per_page
        
        with Database('./database.db') as db:
            blogs = db.fetch_all_blogs(limit=per_page, offset=offset)
            total_count = db.count_blogs()
        
        total_pages = (total_count + per_page - 1) // per_page
        
        return render_template('blog_manage.html', 
                               blogs=blogs,
                               page=page,
                               total_pages=total_pages,
                               total_count=total_count)
    except Exception as e:
        print(f"Error in blog_manage: {e}")
        return render_template('blog_manage.html', blogs=[], page=1, total_pages=0, total_count=0)

@blog.route('/api/blog/like', methods=['POST'])
def blog_like():
    """博客点赞/取消点赞"""
    try:
        if not current_user.is_authenticated:
            return jsonify({"success": False, "error": "请先登录", "need_login": True}), 401
        data = request.get_json()
        blog_id = data.get('blog_id')
        action = data.get('action', 'add')
        user_email = current_user.email
        
        with Database('./database.db') as db:
            if action == 'add':
                success = db.add_blog_like(blog_id, user_email)
            else:
                success = db.remove_blog_like(blog_id, user_email)
            
            if success:
                likes_count = db.get_blog_likes_count(blog_id)
                return jsonify({"success": True, "count": likes_count})
            else:
                return jsonify({"success": False, "error": "操作失败"})
    except Exception as e:
        print(f"Blog like error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@blog.route('/api/blog/comment', methods=['POST'])
def blog_comment():
    """添加博客评论"""
    try:
        if not current_user.is_authenticated:
            return jsonify({"success": False, "error": "请先登录", "need_login": True}), 401
        data = request.get_json()
        blog_id = data.get('blog_id')
        comment_content = data.get('content', '').strip()
        
        if not comment_content:
            return jsonify({"success": False, "error": "评论内容不能为空"})
        
        user_email = current_user.email
        user_nickname = current_user.nickname
        comment_time = get_china_time("%Y-%m-%d %H:%M:%S")
        
        with Database('./database.db') as db:
            success = db.add_blog_comment(blog_id, user_email, user_nickname, comment_content, comment_time)
            
            if success:
                comments = db.get_blog_comments(blog_id)
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
        print(f"Blog comment error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@blog.route('/api/blog/data/<int:blog_id>')
def blog_data(blog_id):
    """获取博客点赞和评论数据"""
    try:
        with Database('./database.db') as db:
            likes_count = db.get_blog_likes_count(blog_id)
            
            has_liked = False
            if current_user.is_authenticated:
                has_liked = db.has_blog_liked(blog_id, current_user.email)
            
            comments = db.get_blog_comments(blog_id)
            formatted_comments = []
            for comment in comments:
                is_mine = current_user.is_authenticated and comment[3] == current_user.email
                formatted_comments.append({
                    "nickname": comment[0],
                    "content": comment[1],
                    "time": comment[2],
                    "is_mine": is_mine
                })
            
            return jsonify({
                "success": True,
                "likes_count": likes_count,
                "has_liked": has_liked,
                "comments": formatted_comments
            })
    except Exception as e:
        print(f"Blog data error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
