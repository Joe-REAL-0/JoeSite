# 生产环境推荐配置

## 1. 使用 Gunicorn 运行（推荐）
# 安装: pip install gunicorn
# 运行: gunicorn -w 4 -b 0.0.0.0:30069 --timeout 120 --max-requests 1000 --preload wsgi:app

## 2. 使用 uWSGI 运行
# 安装: pip install uwsgi
# 运行: uwsgi --http 0.0.0.0:30069 --wsgi-file wsgi.py --callable app --processes 4 --threads 2

## 3. 使用 Supervisor 进程管理
# 安装: pip install supervisor
# 配置文件示例 (supervisor.conf):
# [program:joe_site]
# command=gunicorn -w 4 -b 0.0.0.0:30069 --timeout 120 wsgi:app
# directory=/path/to/Joe_Site
# user=www-data
# autostart=true
# autorestart=true
# redirect_stderr=true
# stdout_logfile=/var/log/joe_site.log

## 4. 环境变量设置
# export SECRET_KEY="your-super-secret-key-here"
# export FLASK_ENV=production
# export MAIL_PASSWORD="your-mail-password"

## 5. 数据库优化
# 建议使用 PostgreSQL 或 MySQL 替代 SQLite
# 添加数据库连接池配置
# 定期备份数据库

## 6. 静态文件服务
# 使用 Nginx 或 Apache 代理静态文件
# 配置 Nginx 示例:
# location /static/ {
#     alias /path/to/Joe_Site/static/;
#     expires 30d;
# }

## 7. 安全配置
# 使用 HTTPS (SSL/TLS)
# 配置防火墙规则
# 设置速率限制
# 启用 CSRF 保护

## 8. 监控和日志
# 使用 ELK Stack 或 Prometheus + Grafana
# 配置错误报告（如 Sentry）
# 设置健康检查端点
