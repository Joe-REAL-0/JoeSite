"""
工具函数模块，提供通用功能
"""
from datetime import datetime, timezone, timedelta
import markdown
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.tables import TableExtension
from markdown.extensions.toc import TocExtension
import bleach

def get_china_time(format_str="%Y-%m-%d %H:%M:%S"):
    """
    获取东八区（中国）时间
    
    Args:
        format_str (str): 时间格式字符串，默认为 "%Y-%m-%d %H:%M:%S"
    
    Returns:
        str: 格式化的东八区时间字符串
    """
    utc_now = datetime.now(timezone.utc)
    china_timezone = timezone(timedelta(hours=8))
    china_time = utc_now.astimezone(china_timezone)
    return china_time.strftime(format_str)

def render_markdown(content):
    """
    将Markdown内容渲染为HTML
    
    Args:
        content (str): Markdown格式的文本内容
    
    Returns:
        str: 渲染后的HTML内容
    """
    if not content:
        return ""
    
    # 配置Markdown扩展
    extensions = [
        'markdown.extensions.extra',  # 包含多个有用的扩展
        'markdown.extensions.codehilite',  # 代码高亮
        'markdown.extensions.tables',  # 表格支持
        'markdown.extensions.toc',  # 目录支持
        'markdown.extensions.fenced_code',  # 围栏代码块
        'markdown.extensions.nl2br',  # 换行转<br>
        'pymdownx.arithmatex',  # 数学公式支持
        'pymdownx.superfences',  # 增强的代码块
        'pymdownx.highlight',  # 代码高亮
        'pymdownx.inlinehilite',  # 行内代码高亮
        'pymdownx.betterem',  # 更好的强调处理
    ]
    
    # 配置扩展选项
    extension_configs = {
        'markdown.extensions.codehilite': {
            'css_class': 'highlight',
            'linenums': False
        },
        'markdown.extensions.toc': {
            'permalink': True
        },
        'pymdownx.arithmatex': {
            'generic': True  # 使用通用模式，适用于KaTeX
        },
        'pymdownx.highlight': {
            'use_pygments': True,
            'linenums': False
        },
        'pymdownx.superfences': {
            'custom_fences': []
        }
    }
    
    # 渲染Markdown
    md = markdown.Markdown(extensions=extensions, extension_configs=extension_configs)
    html = md.convert(content)
    
    # 允许的HTML标签（用于XSS防护）
    allowed_tags = [
        'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'hr',
        'del', 'ins', 'sub', 'sup',
        'script'  # 允许script标签用于KaTeX数学公式
    ]
    
    allowed_attributes = {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title', 'width', 'height'],
        'code': ['class'],
        'pre': ['class'],
        'div': ['class'],
        'span': ['class'],
        'h1': ['id'],
        'h2': ['id'],
        'h3': ['id'],
        'h4': ['id'],
        'h5': ['id'],
        'h6': ['id'],
        'script': ['type']  # 允许KaTeX使用script标签
    }
    
    # 清理HTML，防止XSS攻击
    cleaned_html = bleach.clean(
        html,
        tags=allowed_tags,
        attributes=allowed_attributes,
        strip=False
    )
    
    return cleaned_html
