#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WSGI配置文件 - 用于生产环境部署
推荐使用 gunicorn 或 uWSGI 运行
"""

from app import app
import logging
import os

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)

# 生产环境设置
if not app.debug:
    # 禁用调试模式
    app.config['DEBUG'] = False
    
    # 设置更安全的密钥
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-production-secret-key')
    
    # 配置数据库连接池（如果使用PostgreSQL或MySQL）
    # app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    #     'pool_size': 10,
    #     'pool_recycle': 120,
    #     'pool_pre_ping': True
    # }

if __name__ == "__main__":
    app.run()
