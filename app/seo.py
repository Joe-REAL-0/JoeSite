from flask import Blueprint, render_template, request, make_response, url_for
from database import Database
from datetime import datetime
import os

seo = Blueprint('seo', __name__)

@seo.route('/sitemap.xml')
def sitemap():
    """动态生成sitemap.xml"""
    try:
        with Database('./database.db') as db:
            # 获取所有已发布的博客
            blogs = db.fetch_published_blogs()
        
        # 获取网站的基础URL（从请求中获取）
        base_url = request.url_root.rstrip('/')
        
        # 构建sitemap XML
        xml_content = ['<?xml version="1.0" encoding="UTF-8"?>']
        xml_content.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
        
        # 添加主页
        xml_content.append('  <url>')
        xml_content.append(f'    <loc>{base_url}/</loc>')
        xml_content.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
        xml_content.append('    <changefreq>weekly</changefreq>')
        xml_content.append('    <priority>1.0</priority>')
        xml_content.append('  </url>')
        
        # 添加博客列表页
        xml_content.append('  <url>')
        xml_content.append(f'    <loc>{base_url}/blog</loc>')
        xml_content.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
        xml_content.append('    <changefreq>daily</changefreq>')
        xml_content.append('    <priority>0.9</priority>')
        xml_content.append('  </url>')
        
        # 添加所有已发布的博客文章
        for blog in blogs:
            blog_id = blog[0]
            updated_time = blog[4] if blog[4] else blog[3]  # updated_time or created_time
            
            # 将时间格式转换为sitemap标准格式
            try:
                # 尝试解析时间字符串
                if updated_time:
                    dt = datetime.strptime(updated_time, '%Y-%m-%d %H:%M:%S')
                    lastmod = dt.strftime('%Y-%m-%d')
                else:
                    lastmod = datetime.now().strftime('%Y-%m-%d')
            except:
                lastmod = datetime.now().strftime('%Y-%m-%d')
            
            xml_content.append('  <url>')
            xml_content.append(f'    <loc>{base_url}/blog/{blog_id}</loc>')
            xml_content.append(f'    <lastmod>{lastmod}</lastmod>')
            xml_content.append('    <changefreq>monthly</changefreq>')
            xml_content.append('    <priority>0.8</priority>')
            xml_content.append('  </url>')
        
        # 添加其他主要页面
        other_pages = [
            ('/oc_introduce', '0.7', 'monthly'),
            ('/friend_link', '0.6', 'weekly'),
            ('/message_wall', '0.7', 'daily'),
        ]
        
        for path, priority, changefreq in other_pages:
            xml_content.append('  <url>')
            xml_content.append(f'    <loc>{base_url}{path}</loc>')
            xml_content.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
            xml_content.append(f'    <changefreq>{changefreq}</changefreq>')
            xml_content.append(f'    <priority>{priority}</priority>')
            xml_content.append('  </url>')
        
        xml_content.append('</urlset>')
        
        # 创建响应
        response = make_response('\n'.join(xml_content))
        response.headers['Content-Type'] = 'application/xml; charset=utf-8'
        return response
        
    except Exception as e:
        print(f"Error generating sitemap: {e}")
        return "Error generating sitemap", 500

@seo.route('/robots.txt')
def robots():
    """生成robots.txt"""
    base_url = request.url_root.rstrip('/')
    
    robots_content = [
        'User-agent: *',
        'Allow: /',
        '',
        '# 禁止爬取管理后台',
        'Disallow: /blog/manage',
        'Disallow: /blog/write',
        'Disallow: /blog/edit/',
        'Disallow: /manage',
        'Disallow: /user_info',
        '',
        '# 禁止爬取API端点',
        'Disallow: /blog/create',
        'Disallow: /blog/update/',
        'Disallow: /blog/delete/',
        'Disallow: /blog/publish/',
        '',
        '# Sitemap位置',
        f'Sitemap: {base_url}/sitemap.xml',
    ]
    
    response = make_response('\n'.join(robots_content))
    response.headers['Content-Type'] = 'text/plain; charset=utf-8'
    return response

@seo.route('/rss.xml')
@seo.route('/feed.xml')
def rss_feed():
    """生成RSS feed"""
    try:
        with Database('./database.db') as db:
            # 获取最新的10篇已发布博客
            blogs = db.fetch_published_blogs(limit=10)
        
        base_url = request.url_root.rstrip('/')
        
        # 构建RSS XML
        rss_content = ['<?xml version="1.0" encoding="UTF-8"?>']
        rss_content.append('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">')
        rss_content.append('  <channel>')
        rss_content.append('    <title>Joe的个人博客</title>')
        rss_content.append(f'    <link>{base_url}/blog</link>')
        rss_content.append('    <description>Joe的个人网站博客 - 技术分享与生活记录</description>')
        rss_content.append('    <language>zh-CN</language>')
        rss_content.append(f'    <lastBuildDate>{datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0800")}</lastBuildDate>')
        rss_content.append(f'    <atom:link href="{base_url}/rss.xml" rel="self" type="application/rss+xml"/>')
        
        # 添加每篇博客
        for blog in blogs:
            blog_id = blog[0]
            title = blog[1]
            summary = blog[2] if blog[2] else '点击查看全文...'
            created_time = blog[3]
            
            # 转换时间格式为RSS标准格式
            try:
                dt = datetime.strptime(created_time, '%Y-%m-%d %H:%M:%S')
                pub_date = dt.strftime('%a, %d %b %Y %H:%M:%S +0800')
            except:
                pub_date = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0800')
            
            # 转义XML特殊字符
            title_escaped = (title.replace('&', '&amp;')
                           .replace('<', '&lt;')
                           .replace('>', '&gt;')
                           .replace('"', '&quot;')
                           .replace("'", '&apos;'))
            summary_escaped = (summary.replace('&', '&amp;')
                             .replace('<', '&lt;')
                             .replace('>', '&gt;')
                             .replace('"', '&quot;')
                             .replace("'", '&apos;'))
            
            # 获取博客标签
            with Database('./database.db') as db:
                tags = db.fetch_blog_tags(blog_id)
            
            rss_content.append('    <item>')
            rss_content.append(f'      <title>{title_escaped}</title>')
            rss_content.append(f'      <link>{base_url}/blog/{blog_id}</link>')
            rss_content.append(f'      <guid isPermaLink="true">{base_url}/blog/{blog_id}</guid>')
            rss_content.append(f'      <description>{summary_escaped}</description>')
            rss_content.append(f'      <pubDate>{pub_date}</pubDate>')
            
            # 添加标签为category元素（RSS标准）
            for tag in tags:
                tag_name = tag[1].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                rss_content.append(f'      <category>{tag_name}</category>')
            
            rss_content.append('    </item>')
        
        rss_content.append('  </channel>')
        rss_content.append('</rss>')
        
        response = make_response('\n'.join(rss_content))
        response.headers['Content-Type'] = 'application/rss+xml; charset=utf-8'
        return response
        
    except Exception as e:
        print(f"Error generating RSS feed: {e}")
        return "Error generating RSS feed", 500

def generate_meta_tags(page_type, **kwargs):
    """
    生成页面meta标签的辅助函数
    
    Args:
        page_type: 页面类型 ('home', 'blog_list', 'blog_detail', etc.)
        **kwargs: 页面特定的数据
    
    Returns:
        dict: 包含所有meta标签数据的字典
    """
    base_url = request.url_root.rstrip('/') if request else 'https://furryjoe.site'
    
    meta = {
        'site_name': 'Joe的个人小站',
        'url': base_url + request.path if request else base_url,
    }
    
    if page_type == 'home':
        meta.update({
            'title': 'Joe的个人小站 | 主页',
            'description': '欢迎来到Joe的个人网站！这里有角色介绍、技术博客、个人笔记、友情链接和留言墙。',
            'keywords': 'Joe, 个人网站, 博客, OC介绍, 技术分享',
            'og_type': 'website',
        })
    elif page_type == 'blog_list':
        meta.update({
            'title': 'Joe的个人小站 | 博客',
            'description': 'Joe的个人博客 - 技术分享、学习笔记与生活记录',
            'keywords': 'Joe博客, 技术博客, 编程笔记, 学习分享',
            'og_type': 'blog',
        })
    elif page_type == 'blog_detail':
        blog = kwargs.get('blog', {})
        title = blog.get('title', '博客文章')
        summary = blog.get('summary', '')
        meta.update({
            'title': f'{title} | Joe的博客',
            'description': summary[:160] if summary else f'{title} - Joe的个人博客',
            'keywords': f'Joe博客, {title}',
            'og_type': 'article',
            'article_published_time': blog.get('created_time', ''),
            'article_modified_time': blog.get('updated_time', ''),
        })
    
    return meta
