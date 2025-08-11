#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
测试环境变量是否正确加载
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 打印环境变量
print(f"ADMIN_EMAIL: {os.getenv('ADMIN_EMAIL')}")
print(f"ADMIN_USERNAME: {os.getenv('ADMIN_USERNAME')}")
print(f"ADMIN_PASSWORD: {os.getenv('ADMIN_PASSWORD', '[密码已隐藏]')}")
